# Changelog

Все заметные изменения в проекте `stem_bot` фиксируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

### Added (2026-10-14)
- **Инфраструктура и Git Flow**:
  - Настроены ветки `main` и `dev`, автоудаление смерженных веток, шаблоны Pull Request и Issues (`.github/`), адаптивный CI/CD пайплайн (`.github/workflows/ci.yml`), `.gitignore` и `.editorconfig`.
  - Настроены правила и скиллы для AI-агентов (`AGENTS.md`, `CLAUDE.md`, `.devin/config.json`, `/twa-audit`, `/pr-check`, `/handoff`).
- **Архитектура и Документация (`docs/`)**:
  - `docs/BRIEF_AND_LEGACY_AUDIT.md` — аудит старого бота `neurofauna_bot`, требования брифа STEM ЦУ и матрица ролей команды (RACI).
  - `docs/ARCHITECTURE.md` — архитектура монорепозитория, описание универсального игрового ядра и правил FSD.
  - `docs/TWA_DESIGN_AND_SECURITY.md` — гайдлайны по безопасности и нативному дизайну Telegram Mini Apps (Bot API 8.0–10.1, `@tma.js/*`).
  - `docs/PROJECT_STATE.md` — живой документ текущего состояния проекта и чеклист для передачи контекста между участниками и AI-сессиями.
- **Универсальное ядро конструктора (`packages/shared`)**:
  - Декларативные Zod-схемы `GameTemplateSchema`, `CardItemSchema`, `PerkPropertySchema`, `BoardCellSchema`, `TeamSchema`.
  - Математический движок расчёта статов команды (`calculateTeamStats`) и автоматический валидатор экономического баланса (`validateGameBalance`).
  - Два готовых пресета игровых систем: *«НейроФауна: Эволюция»* и *«АэроТех: Нейро-Дирижабли»*.
- **Backend API & Telegram Bot (`apps/server`)**:
  - HTTP-сервер на **Hono** (`^4.13.13`) с модулями `/api/game`, `/api/team`, `/api/admin`.
  - Middleware безопасности `tmaAuthMiddleware` на базе `@tma.js/init-data-node` (`^2.0.8`) с проверкой HMAC-SHA256 подписи и `expiresIn`.
  - Telegram-бот на **grammY** (`^1.46.0`) с запуском Mini App.
- **Telegram Mini App (`apps/web`)**:
  - Фронтенд на **React 19 + Vite 6 + Tailwind CSS v4** по структуре **FSD (Feature-Sliced Design)**.
  - Интеграция с `@tma.js/sdk-react` (`^3.0.23`): монтирование `themeParams`, `miniApp`, `viewport` (`bindCssVars`, `expand`), `swipeBehavior.disableVertical()`, `hapticFeedback` и передача заголовка `Authorization: tma <rawInitData>`.
  - Экраны `TeamDashboardPage` (сборка по слотам, статы, прогресс-бар трека, магазин карточек и перков) и `AdminConsolePage` (переключение игровых сеттингов на лету, смена дня, открытие/закрытие магазина, начисление валюты, движение по треку, отчёт валидатора баланса).
