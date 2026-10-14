# Архитектура STEM Game Constructor

## 1. Монорепозиторий (npm workspaces)

```
packages/shared   игровое ядро: схемы, расчёты, баланс, пресеты (без I/O)
apps/server       Hono API + grammY бот, доменные модули
apps/web          Telegram Mini App (React, FSD)
```

Сквозная типизация: типы — `z.infer` от схем `packages/shared`; сервер и клиент импортируют `@stem/shared` напрямую (TS-исходники, без сборки пакета).

Инструменты: TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Biome (lint + format), Steiger (границы FSD), Vitest, GitHub Actions (lint → typecheck → test → build → `npm audit --omit=dev`).

## 2. Игровое ядро (`packages/shared`)

Любая игра описывается данными `GameTemplate`:

- **Метаданные**: тема, валюта (`currencyName`, `currencyIcon`), `totalDays`, трек (`trackName`, `trackMax`), дневной лимит покупок, причины начислений.
- **Характеристики** (`stats`) и **слоты** (`slots`) — произвольные списки.
- **Карточки** (`cards`): слот, цена, день открытия, модификаторы статов, `trackBonus`.
- **Свойства** (`perks`): цена, день, статы, условие `minStatsCondition`, текст эффекта.
- **Клетки поля** (`boardCells`): тип, подпись, цена откупа.

Функции: `calculateTeamStats` (карты + перк + модификаторы), `validateGameBalance` (статический анализ).

**Ограничение текущей модели:** правила шага, пороги клеток и эффекты перков пока не выражены данными — только текстом. Целевая декларативная модель (триггер → условие → эффект), уникальные экземпляры карт и вторая механика описаны в `docs/legacy/NEUROFAUNA_RULES.md` §5 и скилле `game-engine`.

## 3. Сервер (`apps/server`)

Сервер — единственный источник истины. Подробно о синхронизации — `docs/research/REALTIME.md`.

```
src/index.ts                 подключение БД (Postgres или PGlite), сид события, Hono, WebSocket, бот
src/db/schema.ts             Drizzle-схема: events, teams, members, card_stock, proposals, ledger, commands
src/db/client.ts             postgres-js (prod) / PGlite (dev, тесты) + миграции из drizzle/
src/modules/event/           граф события, снимок для зрителя, mutateEvent() (транзакция, версия, журнал, идемпотентность), сид
src/modules/team/            вход по коду, покупка капитаном, отмена, предложения, свойства
src/modules/admin/           начисления, фазы с таймером, ход, новый день, команды, капитаны, перезапуск
src/realtime/hub.ts          комнаты по событию, склейка изменений 30 мс, рассылка снимков по зрителям
src/realtime/ws-server.ts    /api/ws: авторизация первым сообщением, Origin, heartbeat, лимиты
src/shared/identity.ts       Telegram initData → Identity; dev-пользователи вне прода
src/bot/                     grammY: /start, вебхук (prod) или polling только с BOT_POLLING=true
```

API (`Authorization: tma <initData>`, мутации с `Idempotency-Key`, каждая возвращает свежее `LiveState`):

| Метод | Путь | Кто |
| :--- | :--- | :--- |
| GET | `/api/health` · `/api/game/state` | все |
| WS | `/api/ws` | все (сообщения `snapshot`, `rules`, `state`, `pong`) |
| POST | `/api/team/join` · `/buy-card` · `/undo-purchase` · `/propose` · `/proposals/:id` · `/buy-perk` | участник (покупки — капитан) |
| POST | `/api/admin/reward` · `/track` · `/phase` · `/settings` · `/next-day` · `/apply-turn` · `/teams` · `/captain` · `/remove-member` · `/reset` | админ |

## 4. Mini App (`apps/web`, Feature-Sliced Design)

```
app/        main.tsx (init SDK до рендера), App.tsx (вкладки, RunAction), styles.css (токены темы)
pages/      team-dashboard, admin-console
widgets/    team-summary, slot-build, shop, teams-board, balance-report
features/   purchase, manage-team, control-shift   (UI + API действия)
entities/   game (LiveConnection: WS + реконнект + опрос, useLiveGame), team, card
shared/     api (request/postJson с tma-заголовком), lib (Telegram SDK, RunAction), ui (Button, Badge, Section)
```

- Импорт только на слои ниже; слайс экспортирует только `index.ts`. Проверяет `npm run lint` (steiger). Правило `fsd/insignificant-slice` выключено: на старте многие слайсы используются один раз, но заложены под переиспользование (бот-админка, конструктор шаблонов).
- Мутации: компонент фичи вызывает `run(() => api(...))`; `App` обрабатывает ошибку, haptics и перезагрузку снапшота.
- Цвета — только токены Tailwind поверх `--tg-theme-*` (fallback `light-dark()`); safe area учитывается на `body`.

## 5. Куда расти

1. Декларативные правила ядра + полный пресет НейроФауны + симулятор баланса.
2. БД (Drizzle + SQLite/PostgreSQL): команды, экземпляры карт, история валюты, админы, коды регистрации, сессии мероприятий (мультитенантность).
3. Роли и привязка игрока к команде по `initData.user.id`.
4. Генератор шаблонов (structured output по `GameTemplateSchema`) с repair-циклом через валидатор и симуляцию.
