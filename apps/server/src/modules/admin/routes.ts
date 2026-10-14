import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { requireAdmin } from "../../shared/telegram-auth.js";
import { validateJson } from "../../shared/validate-json.js";
import { moveTeamOnTrack, rewardTeam, switchTemplate, updateGameState } from "./service.js";

const RewardInput = z.object({ teamId: z.string(), amount: z.number().int() });
const TrackInput = z.object({ teamId: z.string(), delta: z.number().int() });
const GameStateInput = z.object({
  currentDay: z.number().int().min(1).optional(),
  purchasePhaseActive: z.boolean().optional(),
  dailyPurchaseLimit: z.number().int().nullable().optional(),
});
const SwitchTemplateInput = z.object({ templateId: z.string() });

export const adminRouter = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .post("/reward", validateJson(RewardInput), (c) => {
    const { teamId, amount } = c.req.valid("json");
    return c.json({ team: rewardTeam(teamId, amount) });
  })
  .post("/move-track", validateJson(TrackInput), (c) => {
    const { teamId, delta } = c.req.valid("json");
    return c.json({ team: moveTeamOnTrack(teamId, delta) });
  })
  .post("/game-state", validateJson(GameStateInput), (c) =>
    c.json({ gameState: updateGameState(c.req.valid("json")) }),
  )
  .post("/switch-template", validateJson(SwitchTemplateInput), (c) =>
    c.json(switchTemplate(c.req.valid("json").templateId)),
  );
