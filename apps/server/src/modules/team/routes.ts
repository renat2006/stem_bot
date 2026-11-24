import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { mutationOptions, stateResponse } from "../../shared/route-context.js";
import { requireIdentity } from "../../shared/telegram-auth.js";
import { validateJson } from "../../shared/validate-json.js";
import {
  buyCard,
  buyP2PListing,
  buyPerk,
  cancelP2PListing,
  createP2PListing,
  equipFromInventory,
  joinTeam,
  pingTeamSlot,
  placeAuctionBid,
  proposeCard,
  resolveProposal,
  runDiagnosisProbe,
  saveTransferNote,
  submitDiagnosisVerdict,
  submitProgramOrder,
  undoLastPurchase,
} from "./service.js";

const JoinInput = z
  .object({
    code: z.string().trim().min(4).max(12).optional(),
    teamId: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().trim().max(40),
  })
  .refine((v) => Boolean(v.code || v.teamId), { message: "Укажите код команды" });
const CardInput = z.object({
  cardId: z.string().min(1).max(80),
  listingId: z.string().min(1).max(80).optional(),
});
const PerkInput = z.object({ perkId: z.string().min(1).max(80) });
const DecisionInput = z.object({ accept: z.boolean() });
const EquipSwapInput = z.object({
  slotId: z.string().min(1).max(40),
  cardId: z.string().min(1).max(80).nullable(),
});
const P2PCreateInput = z.object({
  cardId: z.string().min(1).max(80),
  price: z.number().int().min(1).max(200),
  fromEquippedSlot: z.string().min(1).max(40).optional(),
});
const ListingIdInput = z.object({ listingId: z.string().min(1).max(80) });
const BidInput = z.object({ amount: z.number().int().min(1).max(500) });
const ProgramOrderInput = z.object({
  leverIndex: z.number().int().min(0).max(4),
  value: z.union([z.string().min(1).max(40), z.boolean()]),
});
const PingSlotInput = z.object({
  slotIndex: z.number().int().min(0).max(4),
});
const ProbeInput = z.object({
  probeId: z.string().min(1).max(40),
});
const VerdictInput = z.object({
  hypothesisId: z.string().min(1).max(40),
});
const TransferNoteInput = z.object({
  note: z.string().trim().min(1).max(240),
});

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
  .post("/equip-inventory", validateJson(EquipSwapInput), async (c) => {
    const options = await mutationOptions(c);
    await equipFromInventory(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/p2p/list", validateJson(P2PCreateInput), async (c) => {
    const options = await mutationOptions(c);
    await createP2PListing(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/p2p/cancel", validateJson(ListingIdInput), async (c) => {
    const options = await mutationOptions(c);
    await cancelP2PListing(options, c.req.valid("json").listingId);
    return stateResponse(c, options.eventId);
  })
  .post("/p2p/buy", validateJson(ListingIdInput), async (c) => {
    const options = await mutationOptions(c);
    await buyP2PListing(options, c.req.valid("json").listingId);
    return stateResponse(c, options.eventId);
  })
  .post("/auctions/:id/bid", validateJson(BidInput), async (c) => {
    const options = await mutationOptions(c);
    await placeAuctionBid(options, { auctionId: c.req.param("id"), amount: c.req.valid("json").amount });
    return stateResponse(c, options.eventId);
  })
  .post("/propose", validateJson(CardInput), async (c) => {
    const options = await mutationOptions(c);
    await proposeCard(options, c.req.valid("json"));
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
  })
  .post("/program/order", validateJson(ProgramOrderInput), async (c) => {
    const options = await mutationOptions(c);
    await submitProgramOrder(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/program/ping", validateJson(PingSlotInput), async (c) => {
    const options = await mutationOptions(c);
    await pingTeamSlot(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/diagnosis/probe", validateJson(ProbeInput), async (c) => {
    const options = await mutationOptions(c);
    await runDiagnosisProbe(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/diagnosis/verdict", validateJson(VerdictInput), async (c) => {
    const options = await mutationOptions(c);
    await submitDiagnosisVerdict(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/transfer-note", validateJson(TransferNoteInput), async (c) => {
    const options = await mutationOptions(c);
    await saveTransferNote(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  });
