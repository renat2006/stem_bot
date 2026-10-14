---
name: pr-check
description: Предкоммитная и пред-PR проверка кода (линтеры, типы, секреты, тесты)
allowed-tools:
  - read
  - grep
  - glob
  - exec
triggers:
  - user
  - model
---

Перед созданием коммита или Pull Request выполни следующие проверки:

1. Проверь статус и дифф: `git status` и `git diff`
2. Убедись, что в диффе нет секретов (`BOT_TOKEN`, `API_KEY`, `.env`, приватных ключей или хардкод-токенов).
3. Проверь соблюдение FSD-архитектуры (`app` → `pages` → `widgets` → `features` → `entities` → `shared`) и отсутствие лишних комментариев, мёртвого кода или мусорных файлов.
4. Если есть `package.json`, запусти проверки (`npm run lint --if-present`, `npm run typecheck --if-present`, `npm test --if-present`).
5. Если есть `pyproject.toml`, запусти `uv run ruff check .` и `uv run pytest`.
6. Сформируй краткое резюме изменений в формате Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) без водяных знаков.
