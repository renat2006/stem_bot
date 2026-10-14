# Гайдлайны по безопасности и дизайну Telegram Mini Apps (Bot API 8.0–10.1 & `@tma.js/*`)

Проверенные источники:
- Официальная спецификация Telegram: `https://core.telegram.org/bots/webapps` (актуально на Bot API 10.1)
- Документация экосистемы `@tma.js`: `https://docs.telegram-mini-apps.com`

---

## 1. Архитектура безопасности (Security Checklist)

### 1.1. Передача и валидация `initData`
- **Формат заголовка**: клиент передаёт сырую строку `initData` в HTTP-заголовке `Authorization: tma <rawInitData>`.
- **Криптографическая проверка на сервере**:
  - Используется `@tma.js/init-data-node` (`validate(rawInitData, botToken, { expiresIn: 3600 })` + `parse(rawInitData)`).
  - Никогда не использовать `initDataUnsafe` для авторизации или определения `user.id` / роли админа на сервере.
  - Обязательно проверять `expiresIn` (поле `auth_date`), чтобы исключить replay-атаки украденным токеном сессии.
- **Сторонняя валидация без `BOT_TOKEN` (Ed25519, Bot API 8.0+)**:
  - Если данные верифицируются внешним микросервисом (например, отдельным ML/аналитическим сервисом), которому нельзя давать `BOT_TOKEN`, используется `validate3rd(rawInitData, botId)` по публичному ключу Ed25519 Telegram (`e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d` для Production).

### 1.2. Авторизация ролей и защита игровых действий
- **Разделение прав**:
  - Все эндпоинты `/api/admin/*` проверяют, что верифицированный `user.id` из `initData` входит в белый список администраторов (`ADMIN_IDS` / `SUPER_ADMIN_IDS` или таблицу админов).
  - В режиме `NODE_ENV=development` допускается dev-байпас только при отсутствии заголовка `tma` для локальной отладки в браузере; в `production` запросы без валидной подписи `tma` немедленно отклоняются с `401 Unauthorized`.
- **Защита экономики от гонок (Race Conditions)**:
  - Проверка баланса команды (`currency >= price`), лимита покупок за день (`purchasesToday < dailyPurchaseLimit`) и активности фазы (`purchasePhaseActive === true`) выполняется строго атомарно на сервере.
- **Типы идентификаторов Telegram**:
  - `user.id` и `chat.id` могут превышать 32 бита (до 52 значащих бит) — в JS/TS использовать `number` (double-precision до $2^{53}-1$) или `bigint`/`string`, а в SQL — строго `BIGINT`.

### 1.3. Безопасное хранение на клиенте (Bot API 9.0+)
- **`SecureStorage`**: для чувствительных токенов/ключей на клиенте использовать `secureStorage` (аппаратный iOS Keychain / Android Keystore, до 10 ключей на пользователя).
- **`DeviceStorage`**: для кэширования черновиков и UI-состояния (до 5 МБ на бота) использовать `deviceStorage` вместо ненадёжного `localStorage` внутри WebView.

---

## 2. Нативный дизайн, Viewport и UX (Design Guidelines)

### 2.1. Инициализация и плавный старт
- Вызывать `miniApp.ready()` как можно раньше после монтирования базового скелета интерфейса, чтобы скрыть системный лоадер Telegram.
- Монтировать и биндить CSS-переменные:
  - `themeParams.mount()` + `themeParams.bindCssVars()`
  - `viewport.mount()` + `viewport.expand()` + `viewport.bindCssVars()`
- Отключать закрытие приложения вертикальным свайпом (`swipeBehavior.disableVertical()`), чтобы вертикальный скролл списка карточек и магазина не сворачивал Mini App.

### 2.2. Безопасные зоны экрана (Safe Areas & Fullscreen, Bot API 8.0+)
При работе в полноэкранном и мобильном режиме обязателен учёт двух контуров отступов:
1. **Системный `SafeAreaInset`** (вырезы экрана, Dynamic Island, системный Home-индикатор):
   - `--tg-viewport-safe-area-inset-top`
   - `--tg-viewport-safe-area-inset-bottom`
   - `--tg-viewport-safe-area-inset-left`
   - `--tg-viewport-safe-area-inset-right`
2. **Контентный `ContentSafeAreaInset`** (нативная шапка и кнопки управления Telegram поверх приложения):
   - `--tg-viewport-content-safe-area-inset-top`
   - `--tg-viewport-content-safe-area-inset-bottom`
- **Стабильная высота**: для фиксированных нижних панелей ориентироваться на `--tg-viewport-stable-height` (обновляется после завершения анимации жестов), а не на дёргающийся `viewportHeight`.

### 2.3. Цветовая палитра и семантика темы (`ThemeParams`)
Чтобы Mini App ощущался частью Telegram на iOS, Android и macOS, используются семантические токены:
- `--tg-theme-bg-color` / `--tg-theme-secondary-bg-color` — основной и вторичный фон.
- `--tg-theme-section-bg-color` + `--tg-theme-section-separator-color` — карточки секций и их разделители.
- `--tg-theme-text-color` / `--tg-theme-subtitle-text-color` / `--tg-theme-hint-color` — иерархия текста.
- `--tg-theme-accent-text-color` / `--tg-theme-button-color` / `--tg-theme-button-text-color` — акцентные элементы и главные CTA.
- `--tg-theme-destructive-text-color` — опасные действия (сброс, списание, удаление).
- Синхронизировать цвет системной шапки и нижней панели через `miniApp.setHeaderColor()` и `miniApp.setBottomBarColor()`.

### 2.4. Нативные контролы и тактильный отклик (`HapticFeedback`)
- **BottomButton (`MainButton` + `SecondaryButton`)**:
  - Использовать для главных целевых действий экрана (подтверждение покупки, сохранение шаблона).
  - При долгих запросах включать `showProgress()`, поддерживается `hasShineEffect` (Bot API 7.10+) и `iconCustomEmojiId` (Bot API 9.5+).
- **BackButton**:
  - Показывать в шапке Telegram при переходе во вложенные экраны вместо рисования кастомной кнопки «Назад» в углу веб-страницы.
- **HapticFeedback**:
  - `impactOccurred('light')` — переключение табов и выбор слотов.
  - `selectionChanged()` — только во время смены активного элемента списка (не при подтверждении).
  - `notificationOccurred('success' | 'warning' | 'error')` — результат покупки карточки, начисления валюты или ошибки лимита.

### 2.5. Адаптация под слабые устройства (Android Performance Class)
- Telegram на Android передаёт в `User-Agent` класс производительности устройства (`LOW`, `AVERAGE`, `HIGH` — доступно через `retrieveAndroidDeviceData()` в `@tma.js/sdk-react`).
- На `LOW`-устройствах необходимо отключать тяжёлые `backdrop-blur` и сложные анимации.
