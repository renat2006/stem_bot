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

```
src/index.ts                 Hono app, onError, запуск бота, graceful shutdown
src/shared/telegram-auth.ts  middleware проверки initData → c.get("tmaInitData")
src/shared/validate-json.ts  Zod-валидация тела запроса (400 { error, issues })
src/shared/errors.ts         DomainError(message, status)
src/shared/store.ts          in-memory хранилище (заменить на БД)
src/modules/<domain>/routes.ts   HTTP: валидация входа → вызов сервиса → JSON
src/modules/<domain>/service.ts  бизнес-логика, бросает DomainError
src/bot/index.ts             grammY: /start, fallback callback, bot.catch
```

API (`/api/*`, заголовок `Authorization: tma <initData>`):

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| GET | `/api/health` | проверка живости (без авторизации) |
| GET | `/api/game/state` | снапшот: состояние, активный шаблон, список шаблонов, отчёт баланса, команды со статами |
| POST | `/api/team/buy-card` · `/buy-perk` | покупка карты/свойства |
| POST | `/api/admin/reward` · `/move-track` · `/game-state` · `/switch-template` | управление игрой |

Безопасность и известные дыры (роли, `teamId` из body) — `docs/research/SECURITY.md`.

## 4. Mini App (`apps/web`, Feature-Sliced Design)

```
app/        main.tsx (init SDK до рендера), App.tsx (вкладки, RunAction), styles.css (токены темы)
pages/      team-dashboard, admin-console
widgets/    team-summary, slot-build, shop, teams-board, balance-report
features/   purchase, manage-team, control-shift   (UI + API действия)
entities/   game (снапшот, типы, useGameSnapshot), team (StatGrid, TrackProgress), card (StatDeltaList)
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
