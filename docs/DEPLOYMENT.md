# Деплой и релизы

## Схема

```
push в main ─┐
Release      ├─► Deploy workflow: Verify (CI) → Build image → Deploy → Public smoke test
вручную      ┘         GHCR: ghcr.io/renat2006/stem-bot:sha-<12>, :main, :<version>, :latest
                       SBOM + build provenance (вкладка Attestations / пакет в GHCR)

GitHub Actions ──ssh (ключ с forced-command)──► stembot@сервер: deploy APP_TAG=… APP_VERSION=…
                                                 └─ /opt/stem-bot/bin/entrypoint → releases/<ts>-<sha>/scripts/deploy.sh
                                                    1. runtime.env из секретов → /srv/stem-bot/shared (600)
                                                    2. docker compose pull/up --wait (healthcheck)
                                                    3. smoke 127.0.0.1:18200/api/health с проверкой версии
                                                    4. Caddy: шаблон → caddy validate → reload (sudo только на caddy-apply)
                                                    5. при ошибке — автооткат на предыдущий тег
Caddy (хост, :443) ── stem-bot.renat.site, stem-bot.195-209-218-212.sslip.io ──► 127.0.0.1:18200
```

Сервисы compose-проекта `stem-bot`:
- `app` — distroless Node 22, non-root, read-only FS, `cap_drop: ALL`, `no-new-privileges`, лимиты памяти/CPU/PID, порт только на `127.0.0.1`. Один процесс отдаёт API, WebSocket, Mini App и вебхук бота; миграции БД применяются при старте.
- `db` — Postgres 17, данные в томе `stem-bot_pgdata`, наружу не опубликован, отдельный `db.env` (токен бота в контейнер БД не попадает).
- `backup` — ежедневный `pg_dump` в `/srv/stem-bot/backups/daily-*.dump`, хранение 14 дней. Перед каждым деплоем дополнительно `predeploy-*.dump` (последние 10).

## Как выпустить релиз

1. Влить изменения в `main` (через PR из `dev`) — прод обновится автоматически, версия `main-<sha>`.
2. Для версии: **Releases → Draft a new release → тег `vX.Y.Z` → Generate release notes → Publish** (или `gh release create vX.Y.Z --generate-notes`). Workflow соберёт образ с тегом версии, приложит к релизу `web`, `server`, `deploy` бандлы и `SHA256SUMS`, выкатит эту версию.
3. Откат: **Actions → Rollback → Run workflow** (возврат на предыдущий выкаченный тег). Ручной деплой: **Actions → Deploy → Run workflow**.

Где смотреть: справа на странице репо — **Deployments / production** (ссылка на прод), **Packages** (образ), **Releases**; в прогоне — summary с версией, тегами и digest.

## Секреты и переменные (Settings → Environments → production)

| Имя | Тип | Назначение |
| :--- | :--- | :--- |
| `DEPLOY_SSH_KEY` | secret | приватный ключ деплоя (ed25519, работает только через forced-command) |
| `DEPLOY_KNOWN_HOSTS` | secret | закреплённые ключи хоста |
| `DEPLOY_HOST` | secret | адрес сервера |
| `WEBHOOK_SECRET` | secret | секрет вебхука Telegram (`X-Telegram-Bot-Api-Secret-Token`) |
| `POSTGRES_PASSWORD` | secret | пароль БД; из него собираются `DATABASE_URL` и `db.env` |
| `BOT_TOKEN` | secret | токен бота от @BotFather — **задаёт владелец** |
| `ADMIN_IDS` / `SUPER_ADMIN_IDS` | secret | Telegram user ID админов через запятую — **задаёт владелец** |
| `DEPLOY_USER` | var | `stembot` |
| `PUBLIC_URL` | var | публичный URL (вебхук, CORS, кнопка Mini App) |
| `APP_DOMAINS` | var | домены для Caddy через запятую; нерезолвящиеся пропускаются |

```bash
gh secret set BOT_TOKEN --env production
gh secret set ADMIN_IDS --env production
```

Деплой разрешён только из `main`, тегов `v*` (политика окружения). Без `BOT_TOKEN` сервис работает, но API отвечает 401.

## Сервер

- Пользователь `stembot`: без пароля, вход только по ключу деплоя с `restrict,command=…` — никакого шелла, проброса портов, PTY; команды `deploy`, `rollback`, `status`, аргументы по белому списку.
- `/srv/stem-bot`: `releases/` (последние 5), `state/` (`current.env`, `previous.env`, `history.jsonl`, `deploy.log`), `shared/runtime.env` (600), `rendered/`.
- `sudo` только на `/opt/stem-bot/bin/caddy-apply /srv/stem-bot/rendered`: проверка запрещённых директив, `caddy validate`, откат файла при ошибке, `reload`.
- Caddy: HTTPS (Let's Encrypt), HSTS, CSP с `frame-ancestors` для `web.telegram.org`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, лимит тела 1 МБ, вебхук принимается только из сетей Telegram (`149.154.160.0/20`, `91.108.4.0/22`), из логов вырезаются `Authorization`, `Cookie` и секрет вебхука.
- Первичная установка (уже выполнена): `sudo deploy/server/install.sh '<публичный ключ деплоя>'`.

Диагностика:

```bash
ssh ubuntu@195.209.218.212 'sudo cat /srv/stem-bot/state/current.env; sudo tail -n 20 /srv/stem-bot/state/deploy.log; docker ps --filter name=stem-bot'
```

## База данных

Восстановление из бэкапа:

```bash
ssh ubuntu@195.209.218.212 'ls -lt /srv/stem-bot/backups | head'
```

```bash
ssh ubuntu@195.209.218.212 'cd /srv/stem-bot/state/current && sudo -u stembot BASE=/srv/stem-bot docker compose exec -T db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_restore -U stembot -d stembot --clean --if-exists" < /srv/stem-bot/backups/<файл>.dump'
```

Миграции только добавляющие: откат приложения на прошлую версию работает поверх новой схемы. Новая миграция: изменить `apps/server/src/db/schema.ts` → `npm run db:generate -w @stem/server` → закоммитить `apps/server/drizzle/`.

## DNS

`stem_bot.renat.site` с подчёркиванием невозможен: публичные CA (Let's Encrypt) не выпускают сертификаты для имён с `_`. Используем **`stem-bot.renat.site`**: создать A-запись `stem-bot` → `195.209.218.212` в панели reg.ru, затем сменить `PUBLIC_URL` на `https://stem-bot.renat.site` и перезапустить Deploy. До этого работает `https://stem-bot.195-209-218-212.sslip.io`.

## Telegram

1. @BotFather → `/newbot` (или существующий) → токен в `BOT_TOKEN`.
2. После деплоя бот сам ставит вебхук `PUBLIC_URL/telegram/webhook` с секретом.
3. @BotFather → Bot Settings → Menu Button / Configure Mini App → URL = `PUBLIC_URL`.
4. Не отключать защиту origin для Mini App (Bot API 10.2).
