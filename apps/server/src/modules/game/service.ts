import { calculateTeamStats, type GameTemplate, type Team, validateGameBalance } from "@stem/shared";
import { config } from "../../shared/config.js";
import { store } from "../../shared/store.js";

export function withComputedStats(team: Team, template: GameTemplate) {
  return { ...team, computedStats: calculateTeamStats(team, template) };
}

export function getGameSnapshot(viewer?: { id?: number; username?: string }) {
  const template = store.getActiveTemplate();
  const isAdmin = viewer?.id !== undefined ? config.adminIds.has(viewer.id) : !config.isProduction;

  let viewerTeamId: string | null = null;
  if (viewer?.username) {
    const clean = viewer.username.replace(/^@/, "").toLowerCase();
    for (const t of store.teams.values()) {
      if (t.captainUsername.toLowerCase() === clean) {
        viewerTeamId = t.id;
        break;
      }
    }
  }

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
    viewer: {
      isAdmin,
      teamId: viewerTeamId,
      isProduction: config.isProduction,
    },
  };
}
