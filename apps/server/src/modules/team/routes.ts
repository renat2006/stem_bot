import { calculateTeamStats } from "@stem/shared";
import { Hono } from "hono";
import { z } from "zod";
import { store } from "../../shared/store.js";

export const teamRouter = new Hono();

const BuyCardInput = z.object({
  teamId: z.string(),
  cardId: z.string(),
});

teamRouter.post("/buy-card", async (c) => {
  const body = BuyCardInput.parse(await c.req.json());
  const template = store.getActiveTemplate();
  const team = store.teams.get(body.teamId);

  if (!team) return c.json({ error: "Команда не найдена" }, 404);
  if (!store.gameState.purchasePhaseActive) {
    return c.json({ error: "Фаза покупок сейчас закрыта администратором" }, 400);
  }

  const limit = store.gameState.dailyPurchaseLimit;
  if (limit !== null && team.purchasesToday >= limit) {
    return c.json({ error: `Достигнут дневной лимит покупок (${limit})` }, 400);
  }

  const card = template.cards.find((item) => item.id === body.cardId);
  if (!card) return c.json({ error: "Карта не найдена" }, 404);
  if (card.dayAvailable > store.gameState.currentDay) {
    return c.json({ error: `Карта откроется в День ${card.dayAvailable}` }, 400);
  }
  if (team.currency < card.price) {
    return c.json({ error: `Недостаточно валюты (${template.currencyName})` }, 400);
  }

  const updated = {
    ...team,
    currency: team.currency - card.price,
    purchasesToday: team.purchasesToday + 1,
    equippedCards: {
      ...team.equippedCards,
      [card.slotId]: card.id,
    },
  };

  store.teams.set(updated.id, updated);

  return c.json({
    team: {
      ...updated,
      computedStats: calculateTeamStats(updated, template),
    },
  });
});

const BuyPerkInput = z.object({
  teamId: z.string(),
  perkId: z.string(),
});

teamRouter.post("/buy-perk", async (c) => {
  const body = BuyPerkInput.parse(await c.req.json());
  const template = store.getActiveTemplate();
  const team = store.teams.get(body.teamId);

  if (!team) return c.json({ error: "Команда не найдена" }, 404);
  if (!store.gameState.purchasePhaseActive) {
    return c.json({ error: "Фаза покупок сейчас закрыта" }, 400);
  }

  const perk = template.perks.find((p) => p.id === body.perkId);
  if (!perk) return c.json({ error: "Свойство не найдено" }, 404);
  if (team.currency < perk.price) {
    return c.json({ error: `Недостаточно валюты (${template.currencyName})` }, 400);
  }

  const updated = {
    ...team,
    currency: team.currency - perk.price,
    activePerkId: perk.id,
  };

  store.teams.set(updated.id, updated);

  return c.json({
    team: {
      ...updated,
      computedStats: calculateTeamStats(updated, template),
    },
  });
});
