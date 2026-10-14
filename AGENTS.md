# Agent Instructions (stem_bot)

## Workflow & Branching
- **`main`** — стабильная production-ветка (только через PR).
- **`dev`** — основная ветка интеграции для командной разработки.
- Рабочие задачи ведутся в короткоживущих ветках от `dev`: `feat/<name>`, `fix/<name>`, `chore/<name>`, `refactor/<name>`.
- Формат коммитов: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).

## Architecture (FSD & Clean Modular Design)
- **Frontend (`apps/web`) — Feature-Sliced Design (FSD)**:
  - Слои (сверху вниз): `app` → `pages` → `widgets` → `features` → `entities` → `shared`.
  - Строгое правило импортов: модуль может импортировать только со слоёв **ниже** (`features` → `entities`/`shared`, но **никогда** `entities` → `features` или кросс-импорты внутри одного слоя).
  - Каждый слайс экспортирует публичное API только через `index.ts`.
- **Backend (`apps/server`) — Clean Modular / Domain Architecture**:
  - Разделение на модули по доменам (`modules/game`, `modules/team`, `modules/shop`, `modules/admin`, `bot/`) с чётким отделением роутов от бизнес-логики.
- **Shared (`packages/shared`)**:
  - Единый источник правды для типов, Zod-схем, игровых шаблонов и чистых функций расчёта баланса/характеристик.

## Code Style & Minimalism (No Junk / No Comments)
- **Никаких лишних комментариев**: код должен быть самодокументируемым за счёт точных имён типов, функций и переменных. Запрещено писать очевидные комментарии, JSDoc-воду, баннеры и закомментированный код.
- **Минимализм и чистота репо**: не плодить пустые обёртки, лишние конфиги, временные файлы и неиспользуемые зависимости. Держать файлы компактными (ориентир до 150–200 строк), лаконичными и легко читаемыми.

## Telegram Mini App (TWA) Standards
- **Security**: Никогда не доверять `initDataUnsafe` на бэкенде. Все запросы от Mini App к API должны проходить валидацию подписи `initData` (HMAC-SHA256 с `BOT_TOKEN`).
- **Native UX**: Использовать `@telegram-apps/sdk-react` (или официальный Telegram WebApp API), `BackButton`, `MainButton`, `HapticFeedback` и учёт Safe Area (`safe-area-inset-*`).
- **Dev Tools**: Использовать локальные скиллы `/twa-audit` для проверки Mini App и `/pr-check` перед отправкой PR.

## Commit Rules
- Писать чистые коммит-сообщения в формате Conventional Commits без каких-либо водяных знаков, ссылок на AI и строк `Co-Authored-By`.
