import { calculateTeamStats, type GameTemplate, type Team, validateGameBalance } from "@stem/shared";
import { store } from "../../shared/store.js";

export function withComputedStats(team: Team, template: GameTemplate) {
  return { ...team, computedStats: calculateTeamStats(team, template) };
}

export function getGameSnapshot() {
  const template = store.getActiveTemplate();
  return {
    gameState: store.gameState,
    template,
    availableTemplates: Array.from(
      store.templates.values(),
      ({ id, title, theme, currencyName, currencyIcon }) => ({
        id,
        title,
        theme,
        currencyName,
        currencyIcon,
      }),
    ),
    balanceReport: validateGameBalance(template),
    teams: Array.from(store.teams.values(), (team) => withComputedStats(team, template)),
  };
}
