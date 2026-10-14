# Agent Instructions (stem_bot)

## Workflow & Branching
- **`main`** — стабильная production-ветка (только через PR).
- **`dev`** — основная ветка интеграции для командной разработки.
- Рабочие задачи ведутся в короткоживущих ветках от `dev`: `feat/<name>`, `fix/<name>`, `chore/<name>`, `refactor/<name>`.
- Формат коммитов: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).

## Telegram Mini App (TWA) Standards
- **Security**: Никогда не доверять `initDataUnsafe` на бэкенде. Все запросы от Mini App к API должны проходить валидацию подписи `initData` (HMAC-SHA256 с `BOT_TOKEN`).
- **Native UX**: Использовать `@telegram-apps/sdk-react` (или официальный Telegram WebApp API), `BackButton`, `MainButton`, `HapticFeedback` и учёт Safe Area (`safe-area-inset-*`).
- **Dev Tools**: Использовать локальные скиллы `/twa-audit` для проверки Mini App и `/pr-check` перед отправкой PR.

## Commit Rules
- Писать чистые коммит-сообщения в формате Conventional Commits без каких-либо водяных знаков, ссылок на AI и строк `Co-Authored-By`.
