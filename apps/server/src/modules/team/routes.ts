import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { validateJson } from "../../shared/validate-json.js";
import { buyCard, buyPerk } from "./service.js";

const BuyCardInput = z.object({ teamId: z.string(), cardId: z.string() });
const BuyPerkInput = z.object({ teamId: z.string(), perkId: z.string() });

export const teamRouter = new Hono<AppEnv>()
  .post("/buy-card", validateJson(BuyCardInput), (c) => {
    const { teamId, cardId } = c.req.valid("json");
    return c.json({ team: buyCard(teamId, cardId) });
  })
  .post("/buy-perk", validateJson(BuyPerkInput), (c) => {
    const { teamId, perkId } = c.req.valid("json");
    return c.json({ team: buyPerk(teamId, perkId) });
  });
