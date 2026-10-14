# STEM Game Constructor (`stem_bot`)

Универсальный конструктор игровых систем (аналоговый SDK + Telegram Mini App + Telegram Bot) для образовательных мероприятий STEM.

## Стек и структура монорепо

- **`packages/shared`** — единые Zod-схемы (`GameTemplate`, `CardItem`, `PerkProperty`, `Team`), пресеты сеттингов (*«НейроФауна»* и *«АэроТех: Нейро-Дирижабли»*), расчёт характеристик и валидатор экономического баланса (`validateGameBalance`).
- **`apps/server`** — Backend API на **Hono** + Telegram-бот на **grammY** + проверка подписи `Telegram.WebApp.initData`. Доменная модульная структура (`modules/game`, `modules/team`, `modules/admin`, `bot/`).
- **`apps/web`** — Telegram Mini App на **React 19 + Vite 6 + TypeScript + Tailwind CSS v4** по канонам **FSD (Feature-Sliced Design)** (`app` → `pages` → `widgets` → `features` → `entities` → `shared`).
- **`docs/`**:
  - `docs/BRIEF_AND_LEGACY_AUDIT.md` — выжимка брифа заказчика, RACI команды и разбор узких мест старого бота `neurofauna_bot`.
  - `docs/ARCHITECTURE.md` — описание архитектуры конструктора игр и правил FSD.

## Быстрый старт

```bash
git clone https://github.com/renat2006/stem_bot.git
cd stem_bot
git checkout dev
npm install

# Запуск Backend API (порт 3001):
npm run dev:server

# Запуск Telegram Mini App (порт 5173):
npm run dev:web

# Проверка типов и сборка всех пакетов:
npm run typecheck
npm run build
```

## Процесс командной работы (Git Flow)

1. **`main`** — Production-ветка (только через PR).
2. **`dev`** — Основная ветка интеграции команды.
3. **Ветки под задачи (от `dev`):** `feat/<name>`, `fix/<name>`, `refactor/<name>`, `chore/<name>`.
4. **Коммиты:** чистые [Conventional Commits](https://www.conventionalcommits.org/) без лишнего шума и водяных знаков.
