---
name: grammy-bot
description: Разработка Telegram-бота на grammY в apps/server/src/bot — команды, уведомления капитанам, запуск Mini App, long polling vs webhook с Hono, обработка ошибок, flood-limits, тестирование. Использовать при любом изменении бота или Bot API-интеграции.
---

# Telegram-бот (grammY 1.x)

## Роль бота в продукте
- Точка входа: `/start` → кнопка Mini App (`InlineKeyboard().webApp`), Menu Button (`setChatMenuButton` / @BotFather), Main Mini App (`t.me/<bot>?startapp`).
- Push-уведомления капитанам: начисление/списание валюты с причиной, открытие магазина, итог хода по полю.
- Быстрые админ-команды (опционально): дублировать критичное из Mini App, когда WebView неудобен.
- Тяжёлый UI (магазин, сборка, таблицы) — только в Mini App.

## Структура
- `bot/index.ts` — сборка `Bot`, регистрация composer-модулей. Новые сценарии — отдельные `Composer` в `bot/<feature>.ts`.
- Бизнес-логику не дублировать в хендлерах: вызывать сервисы из `modules/*/service.ts`.
- Тексты — с данными шаблона (`template.currencyIcon`, `currencyName`), без хардкода «ДНК».

## Обязательно (grammy.dev/advanced/deployment)
- `bot.catch(...)` — уже есть; ошибки логировать с `update_id`.
- Все промисы `await`-ить.
- Fallback `bot.on("callback_query:data", ctx => ctx.answerCallbackQuery())` — уже есть, держать последним.
- `@grammyjs/auto-retry` — для 429/flood-wait при массовых уведомлениях; рассылки — с паузой/очередью.
- Graceful shutdown: `bot.stop()` на SIGINT/SIGTERM — уже в `index.ts`.
- Сессии (если понадобятся) — только со storage-адаптером к БД, не in-memory.

## Long polling vs webhook
- Dev и один сервер: long polling (`bot.start()`) — текущий режим.
- Prod за HTTPS: webhook в том же Hono-приложении:
  ```ts
  app.post("/telegram/webhook", webhookCallback(bot, "hono", { secretToken: process.env.WEBHOOK_SECRET }));
  await bot.api.setWebhook(`${PUBLIC_URL}/telegram/webhook`, { secret_token: process.env.WEBHOOK_SECRET });
  ```
  При вебхуке не вызывать `bot.start()`; долгие операции — в очередь (Telegram ретраит неотвеченные апдейты).

## Актуальные возможности Bot API (до 10.3, авг. 2026)
- 9.4: `style` и `icon_custom_emoji_id` у кнопок клавиатуры.
- 10.2: `is_ephemeral` у `BotCommand` (команды, видимые одному пользователю — удобно для админ-команд); блокировка методов Mini App с чужих origin.
- 10.3: `DisabledButton`, поле `disabled` у `InlineKeyboardButton`.
- Подробнее: `docs/research/TMA_PLATFORM.md`.

## Тестирование
- `bot.handleUpdate(update)` с фейковыми апдейтами; исходящие запросы мокать через `bot.api.config.use(transformer)`.
- Тесты кладём рядом: `bot/*.test.ts` (vitest).
