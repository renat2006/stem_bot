import { Hono } from "hono";
import { calculateTeamStats, validateGameBalance } from "@stem/shared";
import { store } from "../../shared/store.js";

export const gameRouter = new Hono();

gameRouter.get("/state", (c) => {
  const template = store.getActiveTemplate();
  const teams = Array.from(store.teams.values()).map((team) => ({
    ...team,
    computedStats: calculateTeamStats(team, template),
  }));

  return c.json({
    gameState: store.gameState,
    template,
    availableTemplates: Array.from(store.templates.values()).map((t) => ({
      id: t.id,
      title: t.title,
      theme: t.theme,
      currencyName: t.currencyName,
      currencyIcon: t.currencyIcon,
    })),
    balanceReport: validateGameBalance(template),
    teams,
  });
});
