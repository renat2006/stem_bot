---
name: pr-check
description: Предкоммитная и пред-PR проверка stem_bot — линтеры (biome, steiger), типы, тесты, сборка, секреты, FSD, безопасность API, актуальность CHANGELOG/PROJECT_STATE. Использовать перед каждым коммитом с кодом и перед созданием PR.
---

1. `git status` и `git diff` (и `git diff dev...HEAD` для PR): нет ли мусора, временных файлов, закомментированного кода, лишних комментариев.
2. Секреты: в диффе нет `BOT_TOKEN`, ключей, `.env`, приватных URL/ID.
3. Проверки (все должны пройти):
   ```bash
   npm run lint        # biome + steiger (FSD-границы)
   npm run typecheck
   npm test            # vitest
   npm run build
   ```
   Автоисправление форматирования: `npm run format`.
4. Если затронут `apps/server` (auth, роуты, деньги) — пройти чеклист скилла `tma-security`.
5. Если затронут `apps/web` — правила скилла `tma-frontend` (токены темы, нативные контролы, светлая/тёмная тема, 375px).
6. Если затронут `packages/shared` — правила скилла `game-engine` (тесты на каждое изменение расчётов).
7. Новая функциональность или смена статуса → обновлены `CHANGELOG.md` и `docs/PROJECT_STATE.md` (скилл `handoff`).
8. Коммит — Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`), без водяных знаков и `Co-Authored-By`. Ветка от `dev`, PR в `dev`.
