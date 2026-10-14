# Changelog

Все заметные изменения в проекте `stem_bot` фиксируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

### Added (2026-10-14) — визуальный движок, этап 1
- Новый workspace `@stem/art`: Zod-схемы арт-пака и сокетов, риги creature/airship/campus, три процедурных манифеста, детерминированные SVG-детали, генератор имени вида и композиция с полкой неизвестных слотов; 11 тестов.
- `GameTemplate`: optional `artPackId` и `objectRig` с дефолтом creature; три пресета привязаны к своим пакам и ригам.
- `AssemblyStage` и `PartSticker`: сцены hero/card/token, миллиметровка, примерка, анимации установки и удаления, подписи для скринридера, кнопки пустых слотов; ленивые манифесты и fallback при ошибке изображения.
- Сцены подключены к главной, рынку, предложениям капитану, рейтингу и пульту ведущего. Docker устанавливает новый workspace.
- Три эталона «Стикерной лаборатории», контактный лист, исходные промпты и скриншоты 375 px в `docs/design/visual-engine/`. Эталоны ожидают утверждения по ТЗ; production-арт, конвейер ассетов, иконки и экспорт — следующие этапы.

### Added (2026-10-14) — хранилище и синхронизация в реальном времени
- **Postgres 17 + Drizzle ORM**: события, команды, участники (Telegram ID → команда, роль), остатки карт, предложения капитану, журнал действий, идемпотентность команд; миграции при старте; PGlite для локальной разработки и тестов без Docker.
- **WebSocket `/api/ws`**: снимок при подключении, push состояния по версиям после каждого изменения, правила только при смене версии, heartbeat, реконнект с джиттером, fallback на HTTP-опрос, оценка смещения часов для таймеров.
- **Транзакционные мутации** (`mutateEvent`): блокировка события, версия, журнал, `Idempotency-Key` — гонка за последнюю карту и повторные запросы безопасны.
- **Игровой цикл ведущего**: фазы с таймером (рынок на N минут, продление), начисление по критериям сразу нескольким командам, применение хода ко всем (один раз в день), новый день, создание команд с кодами, назначение капитана, перезапуск смены.
- **Вход по коду команды** (первый — капитан), код из `startapp`; покупки делает капитан, участники предлагают карты, капитан видит входящие с прогнозом шага.
- **Деплой**: сервисы `db` и `backup` (ежедневный дамп, 14 дней), бэкап перед каждым деплоем, секрет `POSTGRES_PASSWORD`.
- Интеграционные тесты на настоящем Postgres (PGlite): членство, права, гонка за последнюю карту, идемпотентность, отмена, ход.
- `docs/research/REALTIME.md`, `docs/product/PLAYTEST_NOTES.md` — исследование синхронизации и заметки прогона ролей.

### Changed (2026-10-14)
- Экран участника разнесён на страницы и виджеты (вход, онбординг, главная, трек, правила, входящие предложения); роль и команда приходят с сервера, а не из локального переключателя.
- Срок подписи Telegram — 12 ч (день смены) с понятным сообщением при истечении.

### Security (2026-10-14)
- Команда и роль определяются только по проверенному Telegram ID; чужие коды входа скрыты; анонимные мутации отклоняются; WebSocket проверяет `Origin`, лимитирует сообщения.
- Локальный запуск больше не трогает вебхук прод-бота: polling только с `BOT_POLLING=true`.

### Added (2026-10-14) — дизайн-система «Конструкт» (v2) и механики кабинета участника
- **Дизайн-система «Конструкт» (`apps/web`, `docs/design/`)**:
  - Подключены шрифты `IBM Plex Sans` + `IBM Plex Mono` (`tabular-nums`), трёхслойная система токенов (Telegram `light/dark`, оболочка `pos/neg/warn`, акцентные темы событий `neurofauna`, `startup`, `airship`) в `apps/web/src/app/styles.css`.
  - Реализованы безрастровые CSS-примитивы: `StatGlyph` (5 геометрических форм `tri`, `up`, `sq`, `hex`, `dia`), `Coin`, `DeltaChip` (`StatDeltaList`), `StatMeter` (шкала от −4 до +7 с порогами и режимом сравнения До/После), `StepBlocks` (формула шага из блоков), `TierBars`, `BuySlots`, `ModuleCard`, `BottomSheet`, `ToastWithUndo`.
  - Сохранены спецификации дизайн-ханд-оффа в `docs/design/` (`COMPONENTS.md`, `BOT_MESSAGES.md`, `HANDOFF_README.md`, `tokens.json`).
- **Экраны кабинета участника C1–C8 (`apps/web/src/pages/team-dashboard`)**:
  - **C1 Вход и 3-шаговый Онбординг** (`join`, `onb`) с интерактивными иллюстрациями критериев, замены слота и шкалы порогов.
  - **C2 Команда** (`home`): кольцо таймера фазы `PhaseRing` + `PhaseRail`, карточка команды с местом в рейтинге и слотами покупок, интерактивная схема сборки по `grid-template-areas` с ядром (`core`), шкалы характеристик с порогами, блок шага + мини-трек с точками соперников, карточка дополнительного модуля («Поле событий: Засуха» / «Заказы: Пилот для банка»).
  - **C3 Общий рынок & C4 BottomSheet карточки** (`market`): фильтры по слотам и «По карману», лестница тиров, индикаторы остатка (`stockDots`), превью влияния каждой карты на шаг хода; детальный BottomSheet сравнения «СЕЙЧАС → СТАНЕТ» со штриховкой прибавляемых/теряемых ячеек шкалы и предупреждением о сгорающих блоках шага.
  - **C6 Трек и рейтинг** (`track`) с прогнозом хода и **C8 Правила** (`rules`) с живым поиском и автогенерацией правил из конфигурации `GameTemplate`.
- **Игровое ядро и API (`packages/shared`, `apps/server`)**:
  - В `@stem/shared` добавлены `calculateTeamStep`, `previewCardEffect`, `evaluateBuyState`, пороговые бонусы шага (`stepThresholds`), тиры и остатки карт (`tier`, `stock`), модуль `extraModule`, а также второй полноценный пресет **«Стартап за день»** (`STARTUP_DAY_TEMPLATE`, механика «Заказы» + рынок команд).
  - На сервере (`@stem/server`) реализован учёт остатков карт на общем рынке (`cardStockLeft`, `cardSoldTo`), эндпоинт отмены покупки `POST /api/team/undo-purchase` и эндпоинт предложения карты капитану `POST /api/team/propose-card`, а также проверка `dayAvailable` при покупке свойства.

### Added (2026-10-14) — продакшн-деплой
- **Docker-образ**: distroless Node 22, non-root, один процесс отдаёт API, Mini App и вебхук бота; сервер собирается esbuild в один бандл.
- **Deploy workflow**: CI → сборка образа в GHCR (SBOM, build provenance) → деплой по SSH-ключу с forced-command → публичный smoke-тест; GitHub Release получает web/server/deploy-бандлы и `SHA256SUMS`; workflow **Rollback**.
- **Сервер**: пользователь `stembot`, атомарные релизы с автооткатом, Caddy с HTTPS, HSTS, CSP для Telegram, фильтрацией секретов в логах и вебхуком только из сетей Telegram.
- **Dependabot** (npm, Docker, Actions) и категории release notes.
- `docs/DEPLOYMENT.md` — runbook.

### Security (2026-10-14)
- `/api/admin/*` требует членства в `ADMIN_IDS`/`SUPER_ADMIN_IDS` по проверенному initData.
- Валидация окружения при старте; CORS ограничен публичным origin; вебхук бота с `secret_token`.

### Changed (2026-10-14) — приведение репозитория в порядок
- **Зависимости**: Vite 8, `@vitejs/plugin-react` 6, Zod 4, `@hono/node-server` 2, TypeScript 5.9; Node.js ≥ 22.12 (`.nvmrc`).
- **Сервер**: бизнес-логика вынесена в `modules/*/service.ts`, роуты валидируют вход через `@hono/zod-validator` (400 вместо 500), единый `DomainError` + `app.onError`, типизированный Hono env для проверенного initData, `bot.catch`, fallback для callback-запросов, graceful shutdown.
- **Mini App**: переразложен по Feature-Sliced Design (`shared/entities/features/widgets/pages`), цвета переведены на токены `--tg-theme-*` с fallback `light-dark()` (корректные светлая и тёмная темы), SDK инициализируется до рендера, `miniApp.ready()` после монтирования, haptics на ошибки, убран лишний `telegram-web-app.js`.
- **CI**: lint → typecheck → test → build → `npm audit --omit=dev`; Python-джоба удалена.
- **Документация**: `README`, `ARCHITECTURE` синхронизированы с кодом; `PROJECT_STATE` с честными статусами и известными проблемами; `CLAUDE.md` импортирует `AGENTS.md`.

### Added (2026-10-14)
- **Тулинг**: Biome (lint + format), Steiger (границы FSD), Vitest + характеризационные тесты ядра.
- **Агентские скиллы** (`.claude/skills`, симлинк для Devin): `tma-security`, `tma-frontend`, `grammy-bot`, `game-engine`; обновлены `twa-audit`, `pr-check`, `handoff`. MCP `context7` (`.mcp.json`), `.claude/launch.json` для превью.
- **Эталон оригинала**: `docs/legacy/NEUROFAUNA_RULES.md` + `neurofauna-data.json` (78 карт, 15 свойств, 16 клеток, формула шага).
- **Исследования**: `docs/research/TMA_PLATFORM.md` (Bot API 8.0–10.3, статус пакетов, гайдлайны), `SECURITY.md` (модель угроз, TENET, бэклог), `GAME_DESIGN.md` (геймификация, баланс, симуляция, генерация).

### Removed (2026-10-14)
- `docs/TWA_DESIGN_AND_SECURITY.md` — содержимое перенесено в `docs/research/`.

## [0.1.0] — 2026-10-14 (каркас)

### Added (2026-10-14)
- **Инфраструктура и Git Flow**:
  - Настроены ветки `main` и `dev`, автоудаление смерженных веток, шаблоны Pull Request и Issues (`.github/`), адаптивный CI/CD пайплайн (`.github/workflows/ci.yml`), `.gitignore` и `.editorconfig`.
  - Настроены правила и скиллы для AI-агентов (`AGENTS.md`, `CLAUDE.md`, `.devin/config.json`, `/twa-audit`, `/pr-check`, `/handoff`).
- **Архитектура и Документация (`docs/`)**:
  - `docs/BRIEF_AND_LEGACY_AUDIT.md` — аудит старого бота `neurofauna_bot`, требования брифа STEM ЦУ и матрица ролей команды (RACI).
  - `docs/ARCHITECTURE.md` — архитектура монорепозитория, описание универсального игрового ядра и правил FSD.
  - `docs/TWA_DESIGN_AND_SECURITY.md` — гайдлайны по безопасности и нативному дизайну Telegram Mini Apps (Bot API 8.0–10.1, `@tma.js/*`).
  - `docs/PROJECT_STATE.md` — живой документ текущего состояния проекта и чеклист для передачи контекста между участниками и AI-сессиями.
- **Универсальное ядро конструктора (`packages/shared`)**:
  - Декларативные Zod-схемы `GameTemplateSchema`, `CardItemSchema`, `PerkPropertySchema`, `BoardCellSchema`, `TeamSchema`.
  - Математический движок расчёта статов команды (`calculateTeamStats`) и автоматический валидатор экономического баланса (`validateGameBalance`).
  - Два готовых пресета игровых систем: *«НейроФауна: Эволюция»* и *«АэроТех: Нейро-Дирижабли»*.
- **Backend API & Telegram Bot (`apps/server`)**:
  - HTTP-сервер на **Hono** (`^4.13.13`) с модулями `/api/game`, `/api/team`, `/api/admin`.
  - Middleware безопасности `tmaAuthMiddleware` на базе `@tma.js/init-data-node` (`^2.0.8`) с проверкой HMAC-SHA256 подписи и `expiresIn`.
  - Telegram-бот на **grammY** (`^1.46.0`) с запуском Mini App.
- **Telegram Mini App (`apps/web`)**:
  - Фронтенд на **React 19 + Vite 6 + Tailwind CSS v4** по структуре **FSD (Feature-Sliced Design)**.
  - Интеграция с `@tma.js/sdk-react` (`^3.0.23`): монтирование `themeParams`, `miniApp`, `viewport` (`bindCssVars`, `expand`), `swipeBehavior.disableVertical()`, `hapticFeedback` и передача заголовка `Authorization: tma <rawInitData>`.
  - Экраны `TeamDashboardPage` (сборка по слотам, статы, прогресс-бар трека, магазин карточек и перков) и `AdminConsolePage` (переключение игровых сеттингов на лету, смена дня, открытие/закрытие магазина, начисление валюты, движение по треку, отчёт валидатора баланса).
