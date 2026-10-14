# Agent Instructions (stem_bot)

## Context & Handoff (READ FIRST)
- Перед началом любой задачи прочитай **`docs/PROJECT_STATE.md`** (текущее состояние проекта, что готово и бэклог по ролям) и **`CHANGELOG.md`**.
- Справочники и спецификации:
  - **`docs/ARCHITECTURE.md`** и **`docs/BRIEF_AND_LEGACY_AUDIT.md`** — архитектура и бриф.
  - **`docs/legacy/NEUROFAUNA_RULES.md`** + **`docs/legacy/neurofauna-data.json`** — эталон правил и данных оригинала.
  - **`docs/research/`** (`TMA_PLATFORM.md`, `SECURITY.md`, `GAME_DESIGN.md`) — гайдлайны Telegram Mini Apps, модель угроз и баланс.
  - **`docs/design/`** (`DESIGN_BRIEF.md`, `DESIGN_RESEARCH.md`) — дизайн-исследование и ТЗ на интерфейс.
  - **`docs/DEPLOYMENT.md`** — продакшн-деплой, Docker, Caddy и секреты окружения.
- После завершения фичи или этапа обязательно обновляй **`CHANGELOG.md`** и **`docs/PROJECT_STATE.md`** (скилл `/handoff`).

## Workflow & Branching
- **`main`** — стабильная production-ветка (только через PR, триггерит автодеплой).
- **`dev`** — основная ветка интеграции для командной разработки.
- Рабочие задачи ведутся в короткоживущих ветках от `dev`: `feat/<name>`, `fix/<name>`, `chore/<name>`, `refactor/<name>`.
- Формат коммитов: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).

## Architecture (FSD & Clean Modular Design)
- **Frontend (`apps/web`) — Feature-Sliced Design (FSD, контролируется `steiger`)**:
  - Слои (сверху вниз): `app` → `pages` → `widgets` → `features` → `entities` → `shared`.
  - Импорты строго сверху вниз; каждый слайс экспортирует публичное API только через `index.ts`.
- **Backend (`apps/server`) — Clean Modular / Domain Architecture**:
  - Разделение на модули (`modules/game`, `modules/team`, `modules/admin`, `bot/`, `shared/`) с отделением роутов (`routes.ts`) от бизнес-логики (`service.ts`).
- **Shared (`packages/shared`)**:
  - Единый источник правды для Zod-схем, игровых шаблонов, чистых функций расчёта статов/баланса и Vitest-тестов (`*.test.ts`).

## Code Style & Minimalism (No Junk / No Comments)
- **Никаких лишних комментариев**: код должен быть самодокументируемым. Запрещено писать очевидные комментарии, JSDoc-воду, баннеры и закомментированный код.
- **Минимализм и чистота репо**: не плодить пустые обёртки, лишние конфиги и мусорные файлы. Проверять код через `npm run lint` (Biome + Steiger), `npm run typecheck` и `npm test`.

## Telegram Mini App (TWA) Standards (`@tma.js/*` & Bot API 8.0–10.3)
- **Пакеты**: `@tma.js/sdk-react` v3 и `@tma.js/init-data-node` v2 (не использовать deprecated `@telegram-apps/*`).
- **Security**: проверять `initData` через `tmaAuthMiddleware` и права админа через `requireAdmin`.
- **Skills**: использовать профильные скиллы `/game-engine`, `/tma-frontend`, `/tma-security`, `/grammy-bot`, `/twa-audit`, `/pr-check`, `/handoff`.

## Commit Rules
- Писать чистые коммит-сообщения в формате Conventional Commits без каких-либо водяных знаков, ссылок на AI и строк `Co-Authored-By`.
