# STEM Game Constructor (`stem_bot`)

[![CI](https://github.com/renat2006/stem_bot/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/renat2006/stem_bot/actions/workflows/ci.yml)
[![Deploy](https://github.com/renat2006/stem_bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/renat2006/stem_bot/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/renat2006/stem_bot?include_prereleases&sort=semver)](https://github.com/renat2006/stem_bot/releases)

Конструктор игровых систем для образовательных событий STEM: настраиваемое игровое ядро + Telegram Mini App + Telegram-бот. Основа — игра «НейроФауна» Летней школы STEM.

## Структура

| Пакет | Что внутри |
| :--- | :--- |
| `packages/shared` | Zod-схемы `GameTemplate`, расчёт характеристик, валидатор баланса, пресеты сеттингов |
| `apps/server` | API на Hono (модули `game`, `team`, `admin`: `routes.ts` + `service.ts`), бот на grammY, проверка `initData` |
| `apps/web` | Mini App: React 19, Vite 8, Tailwind v4 на токенах темы Telegram, Feature-Sliced Design |
| `docs/` | состояние проекта, архитектура, бриф, правила оригинала, исследования |

## Быстрый старт

Требуется Node.js ≥ 22.12 (`.nvmrc`).

```bash
npm install
cp .env.example .env
npm run dev
```

Сервер — `http://localhost:3001`, Mini App — `http://localhost:5173` (прокси `/api`). Без `BOT_TOKEN` бот не стартует, API работает в dev-режиме без подписи Telegram.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run format` — автоисправление форматирования (Biome).

## Деплой

Push в `main` выкатывает прод автоматически, публикация Release — версию с артефактами; откат — workflow **Rollback**. Подробно: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Документация

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — что готово, известные проблемы, бэклог по ролям (**начинать отсюда**)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — архитектура и правила слоёв
- [`docs/BRIEF_AND_LEGACY_AUDIT.md`](docs/BRIEF_AND_LEGACY_AUDIT.md) — бриф заказчика, команда, разбор старого бота
- [`docs/legacy/NEUROFAUNA_RULES.md`](docs/legacy/NEUROFAUNA_RULES.md) — полные правила оригинала + данные
- [`docs/research/`](docs/research) — платформа TMA, безопасность, геймдизайн и баланс
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — релизы, секреты, сервер, DNS, Telegram

## Процесс

`main` — релизы (только PR), `dev` — интеграция, задачи в `feat/*`, `fix/*`, `refactor/*`, `chore/*` от `dev`. Коммиты — Conventional Commits. Правила для разработчиков и AI-агентов — [`AGENTS.md`](AGENTS.md), скиллы — `.claude/skills/`.
