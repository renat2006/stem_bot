# Безопасность Telegram Mini Apps — исследование и модель угроз stem_bot

Проверено 2026-10-14. Правила для разработки — скилл `tma-security`.

## 1. Что говорит платформа

- **initData** подписан Telegram: `secret = HMAC_SHA256("WebAppData", bot_token)`, `hash = HMAC_SHA256(data_check_string, secret)`. Проверять на сервере и **всегда** проверять `auth_date`: валидная подпись доказывает только происхождение данных, а не их свежесть.
- **Третьи стороны** проверяют по Ed25519 без токена бота: строка `<bot_id>:WebAppData\n<поля>`, публичные ключи prod `e7bf03a2…242d`, test `40055058…72ec`.
- **`initDataUnsafe` не доверять** ни для чего на сервере.
- **Bot API 10.2 (июль 2026)**: методы Mini App блокируются при вызове с чужого origin. Это защита от встраивания чужих страниц и атак через `postMessage` (ср. CVE-2024-33905: перехват сессий Telegram Web через `postMessage`).

## 2. Исследования и инциденты

**TENET: Telegram Mini App (in)security** (arXiv 2608.17538, 2026):
- Проанализировано 37 Mini Apps, уязвимы 30 (81%): 17 хранили сессионные токены/JWT, 16 — приватные ключи или секреты, 5 — мнемоники открытым текстом в хранилище WebView. Под угрозой около 53 млн MAU.
- Атакующему хватает доступа к файлам Telegram Desktop (инфостилеры, кратковременный доступ к устройству). PIN Telegram защищает UI, но не шифрует хранилище.
- Рекомендации: не хранить долгоживущие токены и секреты открыто; не класть ключ рядом с шифротекстом; `SecureStorage` для секретов; ограничивать возможности токенов.

**Практика open-source (2026):** типовая ошибка — initData принимается до 24 часов и переиспользуется для выпуска новых сессий (replay). Исправления сводятся к окну свежести 5–15 минут для выдачи сессий и одноразовому ключу.

## 3. Модель угроз stem_bot

| Актив | Угроза | Текущее состояние | Мера |
| :--- | :--- | :--- | :--- |
| Валюта и позиции команд | Участник шлёт `POST /api/admin/reward` | **Открыто**: роли не проверяются | `requireAdmin` по `ADMIN_IDS` из проверенного initData |
| Покупки команды | Чужой `teamId` в теле запроса | **Открыто**: команда берётся из body | команда определяется по `initData.user.id` |
| Целостность экономики | Двойной тап, гонки, повтор запроса | частично: проверки есть, но не атомарны (in-memory) | транзакции БД + `Idempotency-Key` |
| API без Telegram | Запрос без подписи | prod: 401; dev: полный байпас | dev-пользователь явно и только при `NODE_ENV !== production` |
| initData | Replay украденной строки | `expiresIn: 3600` | 3600 для чтения; ≤300 с для денежных операций админа |
| BOT_TOKEN | Утечка | только env | не логировать; ML-сервисам — `validate3rd`, без токена |
| Вебхук бота | Поддельные апдейты | long polling | при переходе на webhook — `secret_token` |
| CORS | Чужой сайт дёргает API из браузера пользователя | `cors()` открыт | allowlist домена Mini App в prod |
| Аудит | Спор «кто начислил» | истории нет | `currency_history` с `adminId`, причиной, комментарием |

## 4. Что принято в коде (2026-10-14)

- Валидация initData — `apps/server/src/shared/telegram-auth.ts` (`validate` + `expiresIn`), результат в типизированном `c.get("tmaInitData")`.
- Входные данные — Zod через `validateJson`, ошибки — 400 `{ error, issues }`; доменные ошибки — `DomainError`; стек наружу не уходит.
- Клиент не хранит токенов; заголовок `Authorization: tma <initData>`.

## 5. Бэклог безопасности (по приоритету)

1. **P0**: `requireAdmin` на `/api/admin/*`; команда игрока определяется по `user.id`.
2. **P0**: dev-байпас подставляет явного dev-пользователя вместо пропуска проверки.
3. **P1**: БД с транзакциями и журналом валюты; идемпотентность покупок.
4. **P1**: CORS allowlist, rate limit на мутации.
5. **P2**: миграция на `@tma.js/init-data@4` после stable; `createSecretKey` при старте.
6. **P2**: вебхук с `secret_token` для prod.

## Источники
- [Telegram Mini Apps: Validating data](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Bot API changelog (10.2 — origin restriction)](https://core.telegram.org/bots/api-changelog)
- [TENET: Telegram Mini App (in)security, arXiv 2608.17538](https://arxiv.org/html/2608.17538)
- [Пример replay-уязвимости initData (issue)](https://github.com/PetrFedin/flashin-miniapp/issues/232) · [исправление replay (PR)](https://github.com/zzzzamirhosien-jpg/Faoxima/pull/6)
- [@tma.js/init-data: миграция](https://docs.telegram-mini-apps.com/packages/tma-js-init-data/migrate-from-init-data-node)
