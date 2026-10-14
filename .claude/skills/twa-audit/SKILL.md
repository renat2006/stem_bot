---
name: twa-audit
description: Аудит Telegram Mini App и бота stem_bot по актуальным стандартам Bot API (до 10.3) и @tma.js — SDK, безопасность initData и ролей, нативный UX, тема, safe area, производительность, FSD. Использовать по запросу аудита или перед релизом.
---

Опорные материалы: скиллы `tma-security`, `tma-frontend`, `grammy-bot`; `docs/research/TMA_PLATFORM.md`, `docs/research/SECURITY.md`.

1. **Пакеты**: `npm outdated`; `@tma.js/sdk-react` 3.x (v4 — только после stable), `@tma.js/init-data-node@2` с планом миграции на `@tma.js/init-data@4`; никаких `@telegram-apps/*` SDK и `window.Telegram.WebApp` напрямую.
2. **Безопасность**: идентичность только из проверенного initData; `/api/admin/*` под `requireAdmin`; dev-байпас выключен в prod; CORS ограничен; экономические операции атомарны и журналируются; нет токенов в `localStorage`.
3. **Инициализация SDK** (`apps/web/src/shared/lib/telegram.ts`): `init`, mount `themeParams`/`miniApp`/`viewport`/`swipeBehavior`, `bindCssVars`, `expand`, `disableVertical`, `ready`; все вызовы через `isAvailable()`.
4. **UX**: цвета только через токены темы; safe area/content safe area; `mainButton`/`backButton` вместо самописных; haptics по семантике; подтверждение необратимых действий.
5. **Производительность**: размер бандла (`npm run build`), отсутствие тяжёлых эффектов на Android LOW.
6. **Бот**: `bot.catch`, fallback для callback_query, auto-retry для рассылок, webhook с `secret_token` в prod.
7. **Архитектура**: `npm run lint` (steiger — FSD-границы, biome).

Отчёт: список проблем с Severity (HIGH / MEDIUM / LOW), путём к файлу и конкретным исправлением.
