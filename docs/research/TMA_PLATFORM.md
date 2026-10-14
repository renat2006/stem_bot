# Платформа Telegram Mini Apps — состояние на октябрь 2026

Сводка для разработки `apps/web` и `apps/server/src/bot`. Проверено по первоисточникам 2026-10-14. Правила применения — в скиллах `tma-frontend` и `grammy-bot`.

## 1. Bot API: что нового с 2025 года

| Версия | Дата | Что важно для нас |
| :--- | :--- | :--- |
| 8.0 | 2024-11 | Fullscreen (`requestFullscreen`, `safeAreaInset`, `contentSafeAreaInset`), ярлык на домашний экран, `shareMessage`, `downloadFile`, геолокация, акселерометр/гироскоп, блокировка ориентации |
| 9.0 | 2025-04 | `DeviceStorage` (≤5 МБ) и `SecureStorage` (Keychain/Keystore, ≤10 ключей) |
| 9.1 | 2025-07 | `hideKeyboard` в WebApp |
| 9.4 | 2026-02 | `style` и `icon_custom_emoji_id` у кнопок клавиатур (цветные кнопки) |
| 9.5 | 2026-03 | `iconCustomEmojiId` у `BottomButton` (MainButton/SecondaryButton) |
| 9.6 | 2026-04 | `WebApp.requestChat`, `savePreparedKeyboardButton` |
| 10.1 | 2026-06 | `sendChatJoinRequestWebApp`, поле `chat_join_request_query_id` в initData |
| 10.2 | 2026-07 | **Безопасность**: методы Mini App блокируются при вызове с чужого origin (автоматически с 2026-07-20, отключается в @BotFather на свой риск). `is_ephemeral` у `BotCommand` |
| 10.3 | 2026-08 | `DisabledButton`, `disabled` у `InlineKeyboardButton`, `force_reply` у клавиатур |

**Вывод для проекта:** обязательных миграций нет. Полезны 9.4 и 10.3: цветные и неактивные кнопки в боте для админ-сценариев. Из 10.2 берём эфемерные команды: админ-команды можно показывать только админам. Из 9.0 — `DeviceStorage` для черновиков конструктора.

## 2. Способы запуска Mini App

- **Main Mini App** (профиль бота, `t.me/<bot>?startapp`, `mode=compact`) — основной вход игрока.
- **Menu Button** (`setChatMenuButton`) — постоянная кнопка в чате с ботом.
- **Inline-кнопка `web_app`** — из сообщений бота (уведомления «Магазин открыт → открыть»).
- **Direct link** `t.me/<bot>/<app>?startapp=<payload>` — диплинки (например, сразу на экран команды или регистрации по коду).
- Keyboard-кнопка (`sendData`, ≤4096 байт, закрывает приложение) — нам не нужна.

## 3. Экосистема пакетов (npm, 2026-10-14)

| Пакет | Версия | Статус | Решение |
| :--- | :--- | :--- | :--- |
| `@tma.js/sdk-react` | 3.0.23 (latest), 4.0.0-rc.0 | v4 в RC с 2026-10-11 | остаёмся на 3.x, мигрируем после 4.0.0 stable |
| `@tma.js/sdk` | 3.3.0 / 4.0.0-rc.0 | — | транзитивно через sdk-react |
| `@tma.js/init-data-node` | 2.0.8 | **deprecated** в документации, заменён `@tma.js/init-data` | используем до stable `@tma.js/init-data@4` |
| `@tma.js/init-data` | 0.2.22 (только парсинг), 4.0.0-rc.0 (валидация) | валидация пока только в RC | план миграции ниже |
| `@telegram-apps/*` (старый скоуп SDK) | — | deprecated | не использовать |
| `@telegram-apps/telegram-ui` | 2.1.13 (2025-12) | UI-кит в стиле Telegram, обновляется редко | не подключаем: свои компоненты на токенах темы, меньше бандл |
| `grammy` | 1.46.0 | активен | ✓ |
| `hono` / `@hono/node-server` | 4.13 / 2.1 | активны | ✓ |

### Миграция на `@tma.js/init-data@4` (после stable)
- Все функции подписи — `async` (Web Crypto, работает в Node 20+, Bun, Deno, Workers).
- `validate()` сразу возвращает распарсенные данные, `parse()` отдельно не нужен.
- `createSecretKey(botToken)` один раз на старте — без повторного HMAC на каждый запрос.
- `safeValidate()` возвращает `{ ok, data | error }`; ошибки: `ExpiredError`, `SignatureInvalidError`, `SignatureMissingError`, `AuthDateInvalidError`, `InvalidInitDataError`.
- Строже: `auth_date` только цифры, `hash` — 64 hex, сравнение за константное время.

### SDK v4 (что изменится)
- `useSignal` → `useComputed`; проверки `isSupported()` вместо части `isAvailable()`; новые фичи `Biometry`, `LocationManager`, `QrScanner`, `Serverless`.

## 4. Гайдлайны дизайна (core.telegram.org/bots/webapps)

- Mobile-first, поведение и вид как у нативных компонентов Telegram, анимации 60 fps.
- Подписи у всех полей и изображений (доступность).
- Только цвета темы; реагировать на смену темы (`themeChanged`) — у нас через `bindCssVars` и токены Tailwind.
- Учитывать `safeAreaInset` и `contentSafeAreaInset`, особенно в fullscreen.
- На Android снижать анимации по классу производительности из User-Agent (`LOW`/`AVERAGE`/`HIGH`).

### Палитра → токены проекта (`apps/web/src/app/styles.css`)

| Telegram | Токен Tailwind | Назначение |
| :--- | :--- | :--- |
| `--tg-theme-bg-color` | `bg` | основной фон |
| `--tg-theme-secondary-bg-color` | `secondary` | фон страницы, подложки |
| `--tg-theme-section-bg-color` | `surface` | карточки секций |
| `--tg-theme-section-separator-color` | `separator` | разделители, контуры |
| `--tg-theme-text-color` / `subtitle-text` / `hint` | `text` / `subtitle` / `hint` | иерархия текста |
| `--tg-theme-accent-text-color` | `accent` | акценты, ссылки |
| `--tg-theme-button-color` / `button-text` | `button` / `button-text` | главные CTA |
| `--tg-theme-destructive-text-color` | `destructive` | списание, сброс |
| — | `positive`, `warning` | начисления, предупреждения баланса |

### Нативные контролы
- `MainButton`/`SecondaryButton` (BottomButton) — главное действие экрана; `showLoader()`, `hasShineEffect`, `iconCustomEmojiId` (9.5).
- `BackButton` — вложенная навигация вместо своей стрелки.
- `HapticFeedback`: `impactOccurred` (тап), `selectionChanged` (смена выбора), `notificationOccurred` (результат).
- `Popup` / `closingBehavior.enableConfirmation()` — подтверждение необратимого.
- `swipeBehavior.disableVertical()` — скролл карточек не сворачивает приложение.

## 5. Отладка и окружения

- Тестовый сервер Telegram: аккаунт создаётся в мобильном клиенте (iOS: 10 тапов по Settings → Accounts → Login → Test). На тестовом сервере разрешены HTTP и IP в ссылке Mini App.
- Prod: только HTTPS → туннель (cloudflared/ngrok) к локальному серверу.
- Инспекция: iOS/macOS — Safari Web Inspector; Android — `chrome://inspect`; Telegram Desktop — devtools в beta-сборке.
- Вне Telegram: `mockTelegramEnv({ launchParams })` до `init()` только в DEV.

## Источники
- [Bot API changelog](https://core.telegram.org/bots/api-changelog)
- [Telegram Mini Apps (официальная документация)](https://core.telegram.org/bots/webapps)
- [@tma.js/sdk-react](https://docs.telegram-mini-apps.com/packages/tma-js-sdk-react) · [@tma.js/sdk](https://docs.telegram-mini-apps.com/packages/tma-js-sdk) · [Тестовое окружение](https://docs.telegram-mini-apps.com/platform/test-environment)
- [Миграция init-data-node → init-data](https://docs.telegram-mini-apps.com/packages/tma-js-init-data/migrate-from-init-data-node)
- [grammY: деплой-чеклист](https://grammy.dev/advanced/deployment) · [Long polling vs webhooks](https://grammy.dev/guide/deployment-types)
- [Telegram UI kit](https://github.com/telegram-mini-apps-dev/TelegramUI)
