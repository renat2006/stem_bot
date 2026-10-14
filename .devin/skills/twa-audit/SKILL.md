---
name: twa-audit
description: Аудит безопасности, UX и производительности Telegram Mini App (initData, SDK, Safe Area, MainButton, Haptics)
allowed-tools:
  - read
  - grep
  - glob
  - exec
triggers:
  - user
  - model
---

Проведи комплексный аудит Telegram Mini App (TWA) и Bot-интеграции по следующим критериям:

1. **Безопасность (`initData` Validation)**:
   - Убедись, что бэкенд НЕ доверяет `initDataUnsafe` напрямую от клиента.
   - Проверь наличие серверной криптографической проверки HMAC-SHA256 подписи `initData` через токен бота (или библиотеку `@telegram-apps/init-data-node` / `aiogram.utils.web_app`).
   - Проверь контроль свежести `auth_date` для защиты от replay-атак.

2. **Нативный UX Telegram**:
   - Вызываются ли `WebApp.ready()` и `WebApp.expand()` при старте приложения?
   - Используются ли нативные контролы (`MainButton`, `BackButton`, `HapticFeedback`) вместо кастомных дублирующих кнопок там, где это уместно?
   - Учитываются ли CSS-переменные темы Telegram (`--tg-theme-*`) и безопасные зоны экрана (`safe-area-inset-*`, `contentSafeAreaInset`)?

3. **Производительность в WebView**:
   - Нет ли блокирующих рендер тяжёлых бандлов при первом открытии?
   - Настроен ли code-splitting / lazy-loading для второстепенных экранов?
   - Корректно ли обрабатываются состояния загрузки (Skeleton / оптимистичные обновления)?

Выдай чёткий отчёт со списком найденных проблем (Severity: HIGH / MEDIUM / LOW), путями к файлам и конкретными исправлениями.
