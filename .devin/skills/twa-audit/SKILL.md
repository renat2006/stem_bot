---
name: twa-audit
description: Аудит Telegram Mini App по актуальным стандартам Bot API 8.0-10.1 и @tma.js/sdk-react v3
allowed-tools:
  - read
  - grep
  - glob
  - exec
triggers:
  - user
  - model
---

Проведи комплексный аудит Telegram Mini App (TWA) и Bot-интеграции по актуальным стандартам Telegram Bot API (8.0 — 10.1) и `@tma.js/*`:

1. **Актуальность SDK и пакетов**:
   - Убедись, что используются актуальные пакеты `@tma.js/sdk-react` (v3+) и `@tma.js/init-data-node` (v2+), а НЕ устаревшие (deprecated) `@telegram-apps/*` или голый `window.Telegram.WebApp` без типизации.

2. **Безопасность (`initData` Validation)**:
   - Бэкенд НЕ должен доверять клиентским данным без проверки подписи через `@tma.js/init-data-node` (`validate` / `isValid` с проверкой `expiresIn`).

3. **Нативный UX Telegram (Bot API 8.0–10.1)**:
   - Вызываются ли `init()`, `miniApp.mount()`, `miniApp.ready()`, `viewport.mount()`, `viewport.expand()`, `viewport.bindCssVars()`?
   - Отключены ли вертикальные свайпы закрытия (`swipeBehavior.disableVertical()`), чтобы скролл карточек и конструктора не сворачивал Mini App?
   - Учитываются ли `safeAreaInsets` и `contentSafeAreaInsets` (`--tg-viewport-safe-area-inset-*`, `--tg-viewport-content-safe-area-inset-*`), особенно при использовании `viewport.requestFullscreen()`?
   - Используются ли `mainButton` (`BottomButton`), `secondaryButton`, `backButton`, `hapticFeedback`, а при необходимости локального хранения — `deviceStorage` / `secureStorage` (Bot API 9.0+)?

4. **Чистота архитектуры (FSD) и производительность**:
   - Соблюдается ли иерархия слоёв FSD (`app` → `pages` → `widgets` → `features` → `entities` → `shared`) без лишних комментариев и мусорного кода?

Выдай краткий отчёт со списком найденных проблем (Severity: HIGH / MEDIUM / LOW), путями к файлам и конкретными исправлениями.
