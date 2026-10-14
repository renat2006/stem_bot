# Хранение и синхронизация в реальном времени

Решения и обоснование для бэкенда игры. Реализация — `apps/server/src/{db,realtime,modules/event}`.

## 1. Как делают синхронные многопользовательские игры

- **Сервер — единственный источник истины.** Клиент присылает намерения («купить карту»), сервер проверяет правила и меняет состояние. Клиенту не доверяем ни баланс, ни роль, ни команду.
- **Монотонная версия состояния.** У каждого изменения есть номер; клиент отбрасывает устаревшие сообщения и видит пропуски.
- **Снимок при подключении, затем обновления.** При реконнекте всегда сначала полный снимок, потом изменения: не нужно восстанавливать потерянные дельты.
- **Идемпотентные команды.** Повтор запроса после обрыва связи (двойной тап, ретрай) не применяется дважды: ключ идемпотентности + уникальный индекс в БД в той же транзакции.
- **Heartbeat и переподключение с джиттером.** Пинг каждые 20–30 с, разрыв после пропусков, экспоненциальная задержка со случайной составляющей против «шторма реконнектов».
- **Горизонтальное масштабирование — через общую шину** (Postgres LISTEN/NOTIFY, Redis pub/sub). NOTIFY — только сигнал «есть изменения», истина остаётся в таблицах.

Фреймворки вроде Colyseus держат состояние комнаты в памяти и синхронизируют дельты свойств — это для быстрых игр с частыми апдейтами. У нас игра пофазная (десятки событий в минуту на смену), нужна персистентность, аудит и авторизация Telegram, поэтому выбран тонкий собственный слой поверх `ws` и Postgres.

## 2. Что реализовано

```
Клиент ── HTTP POST (Idempotency-Key, Authorization: tma …) ──► Hono route ──► mutateEvent()
                                                                    │  BEGIN
                                                                    │  SELECT … FROM events FOR UPDATE   ← сериализация изменений смены
                                                                    │  проверка повтора по commands(event_id, key)
                                                                    │  бизнес-правила, UPDATE teams / card_stock / …
                                                                    │  events.version += 1, INSERT ledger (журнал)
                                                                    │  COMMIT
                                                                    └─► hub.publish(eventId) ─ 30 мс склейка ─┐
Клиент ◄── WebSocket /api/ws: snapshot | rules | state | pong ◄── один SELECT графа, нарезка по зрителю ◄┘
```

- **Postgres 17** (Drizzle ORM, миграции в `apps/server/drizzle`, применяются при старте). Таблицы: `events` (состояние смены + копия шаблона правил + `version`), `teams`, `members` (Telegram ID → команда, роль), `card_stock`, `proposals`, `ledger` (журнал всех действий), `commands` (идемпотентность).
- **Конкурентность**: все изменения одной смены сериализуются блокировкой строки события — 50 участников и десятки действий в минуту это выдерживают с запасом; гонка за последнюю карту разрешается однозначно (тест `sells the last copy to exactly one team`).
- **Протокол** (`packages/shared/src/protocol.ts`): `snapshot` при подключении (состояние + правила), `rules` только при смене версии правил (шаблон ~30 КБ не гоняем на каждое изменение), `state` после каждого изменения, `pong` для оценки смещения часов.
- **Срез по зрителю**: коды входа чужих команд, участники и журнал других команд скрыты; админ видит всё.
- **Таймер фазы** — абсолютное время `phaseEndsAt` + смещение часов клиента; рынок закрывается по времени на сервере, без планировщика.
- **Клиент** (`entities/game/model/live-connection.ts`): авторизация первым сообщением (initData не попадает в URL и логи), heartbeat, реконнект с джиттером, при повторных сбоях — HTTP-опрос каждые 5 с, переподключение при возврате в приложение; ответ мутации сразу применяется к состоянию, push от сервера догоняет остальных.
- **Безопасность WS**: проверка `Origin` в проде, таймаут авторизации 10 с, лимит 30 сообщений / 10 с, `maxPayload` 8 КБ.

## 3. Дальше

1. LISTEN/NOTIFY для нескольких инстансов сервера (сейчас один процесс — хаб в памяти).
2. Уведомления в чат бота из того же потока событий (рынок открыт, предложение капитану, начисление) с учётом лимитов Telegram.
3. Live-настройка правил: версия правил уже есть в `events.rules_version`, нужен редактор и дифф для участников.
4. Экспорт журнала (`ledger`) для аналитики смены и калибровки баланса.

## Источники
- [Colyseus: State Synchronization](https://docs.colyseus.io/state) · [Colyseus concepts](https://docs.colyseus.io/concepts)
- [How to Make a Multiplayer Browser Game (2026)](https://app.cinevva.com/guides/multiplayer-browser-game)
- [State sync protocol: versioning, resync (issue)](https://github.com/jjfwang/stoneage-reimagined/issues/287) · [Session lifecycle: heartbeat, reconnect/resume (PR)](https://github.com/jjfwang/stoneage-reimagined/pull/429)
- [Idempotency keys + unique constraints](https://oneuptime.com/blog/post/2026-07-21-deduplicate-idempotency-unique-constraint/view) · [Optimistic locking in PostgreSQL](https://reintech.io/blog/implementing-optimistic-locking-postgresql)
- [Centrifugo: Postgres stream broker, outbox + LISTEN/NOTIFY](https://centrifugal.dev/blog/2026/05/24/pg-stream-broker-benefits)
