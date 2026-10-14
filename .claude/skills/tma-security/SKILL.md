---
name: tma-security
description: Безопасность Telegram Mini App и бэкенда stem_bot — проверка initData, авторизация ролей, защита игровой экономики, хранение на клиенте, вебхуки бота. Использовать при любом изменении apps/server (auth, роуты, сервисы), при работе с initData/ролями/валютой и перед PR, затрагивающим API.
---

# Безопасность TMA + API (stem_bot)

Источники и разбор: `docs/research/SECURITY.md`. Ниже — обязательные правила.

## 1. Идентичность только из проверенного initData
- Клиент шлёт `Authorization: tma <rawInitData>` (`apps/web/src/shared/api/request.ts`).
- Сервер валидирует подпись HMAC-SHA256 (`validate(raw, BOT_TOKEN, { expiresIn })`) в `apps/server/src/shared/telegram-auth.ts` и кладёт результат в `c.get("tmaInitData")`.
- **Никогда** не брать `user.id`, `teamId`, роль или права из тела запроса, query или `initDataUnsafe`. Команда игрока = `team.captainUserId === initData.user.id` (или участник команды), а не `body.teamId`.
- `expiresIn`: 3600 с для сессии игры — потолок. Для чувствительных операций (начисление валюты, смена фазы) допустимо требовать свежесть ≤ 300 с.
- Пакет: `@tma.js/init-data-node@2` (stable, deprecated upstream). Миграция на `@tma.js/init-data@4` после выхода из RC: функции станут `async`, `validate` сразу возвращает распарсенные данные, `createSecretKey` вместо повторного HMAC.
- Сторонние сервисы (ML-генератор) не получают `BOT_TOKEN` — им передаётся initData + `bot_id`, проверка через `validate3rd` (Ed25519).

## 2. Авторизация ролей
- `/api/admin/*` — только для `user.id` из `ADMIN_IDS`/`SUPER_ADMIN_IDS` (позже — таблица админов). Проверка в отдельном middleware `requireAdmin`, не в UI.
- Действия команды — только капитан/участник своей команды.
- Dev-байпас без подписи разрешён **только** при `NODE_ENV !== "production"` и должен подставлять фиктивного dev-пользователя явно, а не пропускать проверку прав.
- Telegram ID — до 52 бит: в БД `BIGINT`, в TS `number` безопасен, в JSON не превращать в строку и обратно без надобности.

## 3. Целостность экономики
- Все проверки (фаза открыта, лимит в день, `currency >= price`, день открытия карты/перка, уникальность карты) — на сервере, атомарно, в одной транзакции БД.
- Каждое изменение валюты/характеристик пишется в историю (`currency_history`: teamId, amount, reason, comment, adminId, createdAt).
- Идемпотентность покупок: клиент шлёт `Idempotency-Key`, сервер не проводит повтор (двойной тап, ретрай сети).
- Отрицательные суммы, переполнение, чужие ID — отклонять Zod-схемой (`validateJson`) и доменными проверками (`DomainError`).

## 4. Клиент и хранение (исследование TENET, arXiv 2608.17538)
- 81% проанализированных Mini Apps хранили токены/секреты открыто в WebView-хранилище. Не класть долгоживущие токены в `localStorage`.
- Секреты на устройстве — только `secureStorage` (Bot API 9.0+, Keychain/Keystore, ≤10 ключей); кэш UI — `deviceStorage` (≤5 МБ).
- Мы не выпускаем свои JWT: initData и так подписан и короткоживущ. Если появятся сессии — короткий TTL + отзыв.
- Bot API 10.2: методы Mini App блокируются с чужих origin. Не отключать защиту в @BotFather, не встраивать сторонние iframe/ссылки без нужды.

## 5. Бот и вебхуки
- `BOT_TOKEN` только в env, не логировать, не отдавать клиенту.
- Вебхук: `setWebhook(url, { secret_token })` + проверка заголовка `X-Telegram-Bot-Api-Secret-Token` (в grammY — опция `secretToken` у `webhookCallback`).
- `bot.catch` обязателен; `@grammyjs/auto-retry` для flood-wait.

## 6. HTTP-слой
- CORS: в prod ограничить origin доменом Mini App (сейчас `cors()` открыт — задача бэклога).
- Ошибки наружу — только `{ error }` без стека (`app.onError`).
- Rate limit на мутирующие эндпоинты (покупки, начисления).

## Чеклист перед PR (API/auth)
- [ ] Новый роут не читает идентичность из body/query.
- [ ] Админский роут закрыт `requireAdmin`.
- [ ] Вход валидируется `validateJson(schema)`.
- [ ] Денежные операции атомарны и пишут историю.
- [ ] Нет секретов в коде/логах/ответах; `.env` не в git.
- [ ] Тест на отказ: без подписи, с просроченной подписью, чужая команда, не-админ.
