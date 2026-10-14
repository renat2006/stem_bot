---
name: tma-frontend
description: Разработка интерфейса Telegram Mini App в apps/web — FSD-слои, тема Telegram, safe area, нативные контролы (MainButton/BackButton/haptics), @tma.js/sdk-react v3, локальная отладка вне Telegram. Использовать при создании/изменении любых экранов, компонентов и стилей Mini App.
---

# Telegram Mini App UI (apps/web)

Справка и источники: `docs/research/TMA_PLATFORM.md`.

## Архитектура (FSD, проверяется `npm run lint` → steiger)
- `app` (инициализация, провайдеры, стили) → `pages` → `widgets` → `features` → `entities` → `shared`.
- Импорт только вниз; соседние слайсы одного слоя не импортируют друг друга.
- Слайс отдаёт наружу только `index.ts`. Сегменты: `ui`, `model`, `api`, `lib`, `config`.
- Куда класть:
  - сущность предметной области + её отображение без действий → `entities/<name>` (team, card, game);
  - пользовательское действие с вызовом API → `features/<verb-noun>` (purchase, manage-team, control-shift);
  - композиция для экрана → `widgets/<name>`;
  - экран → `pages/<name>`;
  - UI-кит, API-клиент, Telegram SDK → `shared/{ui,api,lib}`.
- Мутации идут через `RunAction` (`shared/lib`): `run(() => featureApi(...))` — обработка ошибок, haptics и перезагрузка снапшота в `app/App.tsx`.

## Тема и вёрстка
- Цвета только через токены Tailwind из `app/styles.css`: `bg-bg`, `bg-secondary`, `bg-surface`, `text-text`, `text-subtitle`, `text-hint`, `text-accent`, `bg-button`/`text-button-text`, `text-destructive`, `border-separator`, `text-positive`, `text-warning`. Они ссылаются на `--tg-theme-*` с fallback `light-dark()`. Не использовать `slate-*`, `indigo-*` и прочие хардкод-палитры.
- Safe area: `body` уже учитывает `--tg-viewport-safe-area-inset-*` + `--tg-viewport-content-safe-area-inset-*`. Фиксированные элементы снизу — от `--tg-viewport-stable-height`.
- Mobile-first, ширина 320–430px, тач-цели ≥ 36px, `type="button"` у кнопок, подписи у иконок/полей.
- Анимации лёгкие (transform/opacity). На Android `LOW` (`useAndroidDeviceData().performanceClass`) — без blur и тяжёлых переходов.
- Списки с ключами из ID, не из индекса.

## Telegram SDK (@tma.js/sdk-react 3.x; v4 пока RC)
- `initTelegramSdk()` вызывается в `app/main.tsx` до рендера: `init()`, mount `themeParams`/`miniApp`/`viewport`/`swipeBehavior`, `bindCssVars`, `expand`, `disableVertical`, `miniApp.ready()`.
- Каждый вызов компонента SDK — через `x.isAvailable()` (метод может отсутствовать в старом клиенте).
- Реактивные значения SDK в React — `useSignal(component.value)` из `@tma.js/sdk-react` (в v4 переименован в `useComputed`), а не копии в `useState`.
- Нативные контролы вместо самописных:
  - `mainButton` — главное действие экрана (подтвердить покупку): `setParams({ text, isEnabled, isVisible })`, `onClick`, `showLoader()` на время запроса; снимать обработчик в cleanup.
  - `secondaryButton` — альтернативное действие (отмена/сравнение).
  - `backButton` — навигация во вложенные экраны; `show()` в `useEffect`, `hide()` в cleanup.
  - `hapticFeedback`: `impactOccurred("light")` — тапы/табы, `selectionChanged()` — смена выбора, `notificationOccurred("success" | "error" | "warning")` — результат операции.
  - `popup.show` / `closingBehavior.enableConfirmation()` — подтверждение необратимых действий.
- Хранение: `deviceStorage` — черновики/кэш UI; `secureStorage` — секреты; `localStorage` — не для чувствительного.
- Не подключать `telegram-web-app.js` — tma.js работает через свой bridge.

## Локальная разработка
- `npm run dev` (server :3001 + web :5173, прокси `/api`). Вне Telegram SDK не инициализируется (`isTMA() === false`), API работает через dev-байпас авторизации.
- Для эмуляции окружения: `mockTelegramEnv({ launchParams })` из `@tma.js/sdk-react` только под `import.meta.env.DEV` и до `init()`.
- Реальный клиент: тестовый сервер Telegram (HTTP/IP разрешены), туннель (cloudflared/ngrok) для prod-сервера; отладка — Safari Web Inspector (iOS/macOS), `chrome://inspect` (Android), Telegram Desktop beta (devtools).

## Перед PR
- `npm run lint && npm run typecheck && npm test && npm run build`.
- Проверить светлую и тёмную тему и ширину 375px (built-in browser, `resize_window` mobile + colorScheme).
