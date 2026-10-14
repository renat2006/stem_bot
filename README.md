# STEM Bot & Telegram Mini App

Репозиторий для командной разработки Telegram-бота и Telegram Web App (Mini App).

## Процесс командной работы (Git Flow)

1. **`main`** — Production ветка (всегда стабильна).
2. **`dev`** — Основная ветка разработки. Все новые фичи отводятся от `dev` и вливаются обратно в `dev` через Pull Request.
3. **Именование веток:**
   - `feat/<short-name>` — новая функциональность
   - `fix/<short-name>` — исправление бага
   - `refactor/<short-name>` — рефакторинг без изменения логики
   - `chore/<short-name>` — инфраструктура, конфиги, зависимости
4. **Коммиты:** используем [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`, `chore: ...`).

## Быстрый старт для разработчиков

```bash
# Клонирование и переход на ветку разработки
git clone https://github.com/renat2006/stem_bot.git
cd stem_bot
git checkout dev

# Создание ветки под задачу
git checkout -b feat/my-feature
```

## AI-Ассистенты и окружение

В репозитории настроена конфигурация для AI-агентов (`AGENTS.md`, `CLAUDE.md`, `.devin/`):
- `/twa-audit` — проверка безопасности (`initData`), нативного UX и производительности Telegram Mini App.
- `/pr-check` — автоматическая проверка линтеров, типов, тестов и отсутствия секретов перед PR.
