import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { validateJson } from "../../shared/validate-json.js";
import { buyCard, buyPerk, proposeCardToCaptain, undoLastPurchase } from "./service.js";

const BuyCardInput = z.object({ teamId: z.string(), cardId: z.string() });
const UndoPurchaseInput = z.object({ teamId: z.string() });
const ProposeCardInput = z.object({
  teamId: z.string(),
  cardId: z.string(),
  memberName: z.string().optional(),
});
const BuyPerkInput = z.object({ teamId: z.string(), perkId: z.string() });

export const teamRouter = new Hono<AppEnv>()
  .post("/buy-card", validateJson(BuyCardInput), (c) => {
    const { teamId, cardId } = c.req.valid("json");
    return c.json({ team: buyCard(teamId, cardId) });
  })
  .post("/undo-purchase", validateJson(UndoPurchaseInput), (c) => {
    const { teamId } = c.req.valid("json");
    return c.json({ team: undoLastPurchase(teamId) });
  })
  .post("/propose-card", validateJson(ProposeCardInput), (c) => {
    const { teamId, cardId, memberName } = c.req.valid("json");
    return c.json({ proposal: proposeCardToCaptain(teamId, cardId, memberName) });
  })
  .post("/buy-perk", validateJson(BuyPerkInput), (c) => {
    const { teamId, perkId } = c.req.valid("json");
    return c.json({ team: buyPerk(teamId, perkId) });
  });
