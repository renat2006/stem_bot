import { Hono } from "hono";
import { z } from "zod";
import { store } from "../../shared/store.js";

export const adminRouter = new Hono();

const RewardInput = z.object({
  teamId: z.string(),
  amount: z.number().int(),
});

adminRouter.post("/reward", async (c) => {
  const body = RewardInput.parse(await c.req.json());
  const team = store.teams.get(body.teamId);
  if (!team) return c.json({ error: "Команда не найдена" }, 404);

  const updated = {
    ...team,
    currency: Math.max(0, team.currency + body.amount),
  };
  store.teams.set(updated.id, updated);
  return c.json({ team: updated });
});

const TrackInput = z.object({
  teamId: z.string(),
  delta: z.number().int(),
});

adminRouter.post("/move-track", async (c) => {
  const body = TrackInput.parse(await c.req.json());
  const template = store.getActiveTemplate();
  const team = store.teams.get(body.teamId);
  if (!team) return c.json({ error: "Команда не найдена" }, 404);

  const updated = {
    ...team,
    trackPosition: Math.min(template.trackMax, Math.max(1, team.trackPosition + body.delta)),
  };
  store.teams.set(updated.id, updated);
  return c.json({ team: updated });
});

const PhaseUpdateInput = z.object({
  currentDay: z.number().int().min(1).optional(),
  purchasePhaseActive: z.boolean().optional(),
  dailyPurchaseLimit: z.number().int().nullable().optional(),
});

adminRouter.post("/game-state", async (c) => {
  const body = PhaseUpdateInput.parse(await c.req.json());
  const dayChanged = body.currentDay !== undefined && body.currentDay !== store.gameState.currentDay;

  store.gameState = {
    ...store.gameState,
    ...(body.currentDay !== undefined ? { currentDay: body.currentDay } : {}),
    ...(body.purchasePhaseActive !== undefined ? { purchasePhaseActive: body.purchasePhaseActive } : {}),
    ...(body.dailyPurchaseLimit !== undefined ? { dailyPurchaseLimit: body.dailyPurchaseLimit } : {}),
  };

  if (dayChanged) {
    for (const [id, team] of store.teams.entries()) {
      store.teams.set(id, { ...team, purchasesToday: 0 });
    }
  }

  return c.json({ gameState: store.gameState });
});

const SwitchTemplateInput = z.object({
  templateId: z.string(),
});

adminRouter.post("/switch-template", async (c) => {
  const body = SwitchTemplateInput.parse(await c.req.json());
  const template = store.switchTemplate(body.templateId);
  return c.json({ template, gameState: store.gameState });
});
