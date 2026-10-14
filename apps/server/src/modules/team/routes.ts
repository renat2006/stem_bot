import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { mutationOptions, stateResponse } from "../../shared/route-context.js";
import { requireIdentity } from "../../shared/telegram-auth.js";
import { validateJson } from "../../shared/validate-json.js";
import { buyCard, buyPerk, joinTeam, proposeCard, resolveProposal, undoLastPurchase } from "./service.js";

const JoinInput = z.object({
  code: z.string().trim().min(4).max(12),
  displayName: z.string().trim().max(40),
});
const CardInput = z.object({ cardId: z.string().min(1).max(80) });
const PerkInput = z.object({ perkId: z.string().min(1).max(80) });
const DecisionInput = z.object({ accept: z.boolean() });

export const teamRouter = new Hono<AppEnv>()
  .use("*", requireIdentity)
  .post("/join", validateJson(JoinInput), async (c) => {
    const options = await mutationOptions(c);
    await joinTeam(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/buy-card", validateJson(CardInput), async (c) => {
    const options = await mutationOptions(c);
    await buyCard(options, c.req.valid("json").cardId);
    return stateResponse(c, options.eventId);
  })
  .post("/undo-purchase", async (c) => {
    const options = await mutationOptions(c);
    await undoLastPurchase(options);
    return stateResponse(c, options.eventId);
  })
  .post("/propose", validateJson(CardInput), async (c) => {
    const options = await mutationOptions(c);
    await proposeCard(options, c.req.valid("json").cardId);
    return stateResponse(c, options.eventId);
  })
  .post("/proposals/:id", validateJson(DecisionInput), async (c) => {
    const options = await mutationOptions(c);
    await resolveProposal(options, c.req.param("id"), c.req.valid("json").accept);
    return stateResponse(c, options.eventId);
  })
  .post("/buy-perk", validateJson(PerkInput), async (c) => {
    const options = await mutationOptions(c);
    await buyPerk(options, c.req.valid("json").perkId);
    return stateResponse(c, options.eventId);
  });
