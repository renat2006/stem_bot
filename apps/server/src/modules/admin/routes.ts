import {
  CardRaritySchema,
  DayScheduleItemSchema,
  EffectScopeSchema,
  FeatureFlagsSchema,
  LoreBriefingSchema,
  MarketGenerationInputSchema,
  ShiftPhaseSchema,
  ShiftWizardInputSchema,
  TemplateLexiconSchema,
} from "@stem/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { DomainError } from "../../shared/errors.js";
import { mutationOptions, snapshotResponse, stateResponse } from "../../shared/route-context.js";
import { requireAdmin } from "../../shared/telegram-auth.js";
import { validateJson } from "../../shared/validate-json.js";
import {
  adjustTrack,
  applyParetoFix,
  applyQuickFix,
  applyTurn,
  broadcastMessage,
  closeAuctionNow,
  createShiftFromWizard,
  createTeam,
  decideMarketDraft,
  extendPhaseTimer,
  generateMarketDraft,
  getPendingDraft,
  nextDay,
  removeMember,
  resetEvent,
  revealMissionRound,
  rewardTeams,
  saveDayBriefing,
  setCaptain,
  setPhase,
  startAuction,
  startRoundEngine,
  undoLastRewardBatch,
  updateDaySchedule,
  updateFeatures,
  updateMarketDraft,
  updateSettings,
  updateTemplateLexicon,
  upsertCard,
} from "./service.js";

const RewardInput = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(50),
  amount: z.number().int().min(-50).max(50),
  reason: z.string().trim().min(1).max(120),
  comment: z.string().trim().max(200).optional(),
});
const TrackInput = z.object({
  teamId: z.string().min(1),
  delta: z.number().int().min(-30).max(30),
  reason: z.string().trim().max(120).optional(),
});
const PhaseInput = z.object({
  phase: ShiftPhaseSchema,
  minutes: z.number().int().min(1).max(600).nullable().optional(),
});
const SettingsInput = z.object({ purchaseLimit: z.number().int().min(0).max(20).nullable() });
const TeamInput = z.object({ name: z.string().trim().min(2).max(40) });
const CaptainInput = z.object({ teamId: z.string().min(1), userId: z.number().int().positive() });
const MemberInput = z.object({ userId: z.number().int().positive() });
const ResetInput = z.object({
  templateId: z.string().min(1).optional(),
  demoTeams: z.boolean().default(false),
});
const ExpectedDay = z.number().int().positive().optional();
const TurnInput = z
  .object({
    expectedDay: ExpectedDay,
    buyoffTeamIds: z.array(z.string()).optional(),
    boardPositions: z.record(z.string(), z.number().int().positive()).optional(),
  })
  .optional();

const UpsertCardInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(2).max(80),
  slotId: z.string().min(1).max(40),
  rarity: CardRaritySchema.default("common"),
  tier: z.number().int().min(1).max(5).default(1),
  price: z.number().int().min(0).max(50),
  dayAvailable: z.number().int().min(1).max(14),
  stats: z.record(z.string(), z.number().int().min(-6).max(8)),
  trackBonus: z.number().int().min(-2).max(4).default(0),
  stock: z.number().int().min(1).max(30).default(3),
  stockLeft: z.number().int().min(0).max(30).optional(),
  effectScope: EffectScopeSchema.optional(),
  flavor: z.string().max(160).optional(),
});

const QuickFixInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("grant_all"), amount: z.number().int().min(1).max(20), reason: z.string() }),
  z.object({
    type: z.literal("discount_rarity"),
    rarity: z.enum(["common", "rare"]),
    delta: z.number().int().min(-5).max(5),
  }),
  z.object({
    type: z.literal("bump_card_price"),
    cardId: z.string().min(1),
    delta: z.number().int().min(-5).max(5),
  }),
  z.object({
    type: z.literal("restock_slot"),
    slotId: z.string().min(1),
    amount: z.number().int().min(1).max(10),
  }),
  z.object({
    type: z.literal("enable_feature"),
    feature: z.enum(["catchUpBonus", "p2pMarket", "auctions"]),
  }),
  z.object({ type: z.literal("tighten_p2p_corridor") }),
]);

const BriefingSaveInput = z.object({
  briefing: LoreBriefingSchema,
  broadcast: z.boolean().default(false),
});

const AuctionStartInput = z.object({
  cardId: z.string().min(1).max(80),
  startingPrice: z.number().int().min(1).max(100),
  durationMinutes: z.number().int().min(1).max(120).default(5),
});

const DraftCardsInput = z.object({ cards: z.array(z.unknown()).min(1).max(48) });
const DraftDecisionInput = z.object({
  decision: z.enum(["approve", "reject"]),
  mode: z.enum(["append", "replace"]).default("append"),
});
const ExtendTimerInput = z.object({
  seconds: z.number().int().min(10).max(1800).default(30),
});
const StartRoundInput = z
  .object({
    engine: z.enum(["mission", "diagnosis"]).optional(),
    durationSeconds: z.number().int().min(15).max(1800).optional(),
    conditionId: z.string().max(40).optional(),
  })
  .optional();
const RevealRoundInput = z
  .object({
    conditionId: z.string().max(40).optional(),
  })
  .optional();
const ScheduleUpdateInput = z.object({
  totalDays: z.number().int().min(1).max(14).optional(),
  daySchedule: z.array(DayScheduleItemSchema).min(1).max(14),
});
const ParetoFixInput = z
  .object({
    day: z.number().int().min(1).max(14).optional(),
  })
  .optional();
const BroadcastInput = z.object({
  target: z.string().trim().min(1).max(64).default("all"),
  text: z.string().trim().min(1).max(1000),
  silent: z.boolean().default(false),
});

export const adminRouter = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .post("/reward", validateJson(RewardInput), async (c) => {
    const options = await mutationOptions(c);
    await rewardTeams(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/reward/undo", async (c) => {
    const options = await mutationOptions(c);
    await undoLastRewardBatch(options);
    return stateResponse(c, options.eventId);
  })
  .post("/track", validateJson(TrackInput), async (c) => {
    const options = await mutationOptions(c);
    await adjustTrack(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/phase", validateJson(PhaseInput), async (c) => {
    const options = await mutationOptions(c);
    await setPhase(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/settings", validateJson(SettingsInput), async (c) => {
    const options = await mutationOptions(c);
    await updateSettings(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/next-day", validateJson(z.object({ expectedDay: ExpectedDay })), async (c) => {
    const options = await mutationOptions(c);
    await nextDay(options, c.req.valid("json").expectedDay);
    return stateResponse(c, options.eventId);
  })
  .post("/apply-turn", async (c) => {
    const options = await mutationOptions(c);
    const body = await c.req.json().catch(() => undefined);
    const parsed = TurnInput.safeParse(body);
    if (!parsed.success) throw new DomainError("Проверьте номера клеток", 400);
    await applyTurn(options, parsed.data);
    return stateResponse(c, options.eventId);
  })
  .patch("/features", validateJson(FeatureFlagsSchema.partial()), async (c) => {
    const options = await mutationOptions(c);
    await updateFeatures(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/cards", validateJson(UpsertCardInput), async (c) => {
    const options = await mutationOptions(c);
    await upsertCard(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/quick-fix", validateJson(QuickFixInput), async (c) => {
    const options = await mutationOptions(c);
    await applyQuickFix(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/briefings", validateJson(BriefingSaveInput), async (c) => {
    const options = await mutationOptions(c);
    await saveDayBriefing(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/auctions", validateJson(AuctionStartInput), async (c) => {
    const options = await mutationOptions(c);
    await startAuction(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/auctions/:id/close", async (c) => {
    const options = await mutationOptions(c);
    await closeAuctionNow(options, c.req.param("id"));
    return stateResponse(c, options.eventId);
  })
  .get("/market/draft", async (c) => {
    return c.json({ draft: await getPendingDraft() });
  })
  .post("/market/generate", validateJson(MarketGenerationInputSchema), async (c) => {
    const actor = c.get("identity");
    return c.json(await generateMarketDraft(actor?.userId ?? 0, c.req.valid("json")));
  })
  .put("/market/draft/:draftId", validateJson(DraftCardsInput), async (c) => {
    const updated = await updateMarketDraft(c.req.param("draftId"), c.req.valid("json").cards);
    return c.json({ draft: updated });
  })
  .post("/market/draft/:draftId/decision", validateJson(DraftDecisionInput), async (c) => {
    const options = await mutationOptions(c);
    const body = c.req.valid("json");
    await decideMarketDraft(options, {
      draftId: c.req.param("draftId"),
      decision: body.decision,
      mode: body.mode,
    });
    return snapshotResponse(c);
  })
  .post("/shift/create", validateJson(ShiftWizardInputSchema), async (c) => {
    const options = await mutationOptions(c);
    await createShiftFromWizard(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/teams", validateJson(TeamInput), async (c) => {
    const options = await mutationOptions(c);
    await createTeam(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/captain", validateJson(CaptainInput), async (c) => {
    const options = await mutationOptions(c);
    await setCaptain(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/remove-member", validateJson(MemberInput), async (c) => {
    const options = await mutationOptions(c);
    await removeMember(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/reset", validateJson(ResetInput), async (c) => {
    const options = await mutationOptions(c);
    await resetEvent(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/timer/extend", validateJson(ExtendTimerInput), async (c) => {
    const options = await mutationOptions(c);
    await extendPhaseTimer(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/round/start", async (c) => {
    const options = await mutationOptions(c);
    const body = await c.req.json().catch(() => undefined);
    const parsed = StartRoundInput.safeParse(body);
    await startRoundEngine(options, parsed.success && parsed.data ? parsed.data : {});
    return stateResponse(c, options.eventId);
  })
  .post("/round/reveal", async (c) => {
    const options = await mutationOptions(c);
    const body = await c.req.json().catch(() => undefined);
    const parsed = RevealRoundInput.safeParse(body);
    await revealMissionRound(options, parsed.success ? parsed.data : undefined);
    return stateResponse(c, options.eventId);
  })
  .patch("/lexicon", validateJson(TemplateLexiconSchema.partial()), async (c) => {
    const options = await mutationOptions(c);
    await updateTemplateLexicon(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .patch("/schedule", validateJson(ScheduleUpdateInput), async (c) => {
    const options = await mutationOptions(c);
    await updateDaySchedule(options, c.req.valid("json"));
    return snapshotResponse(c);
  })
  .post("/pareto-fix", async (c) => {
    const options = await mutationOptions(c);
    const body = await c.req.json().catch(() => undefined);
    const parsed = ParetoFixInput.safeParse(body);
    await applyParetoFix(options, parsed.success ? parsed.data : undefined);
    return snapshotResponse(c);
  })
  .post("/broadcast", validateJson(BroadcastInput), async (c) => {
    const options = await mutationOptions(c);
    const result = await broadcastMessage(options, c.req.valid("json"));
    return c.json(result);
  });
