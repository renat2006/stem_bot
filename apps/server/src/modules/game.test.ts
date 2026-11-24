import { ROVER_SPRINT_TEMPLATE } from "@stem/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminBot, createPlayerBot } from "../bot/index.js";
import { connectPglite, type DbHandle } from "../db/client.js";
import { cardStock, teams } from "../db/schema.js";
import { RealtimeHub } from "../realtime/hub.js";
import { config } from "../shared/config.js";
import { DomainError } from "../shared/errors.js";
import type { Identity } from "../shared/identity.js";
import { runtime, setRuntime } from "../shared/runtime.js";
import {
  applyParetoFix,
  applyQuickFix,
  applyTurn,
  closeAuctionNow,
  createShiftFromWizard,
  createTeam,
  decideMarketDraft,
  generateMarketDraft,
  nextDay,
  revealMissionRound,
  rewardTeams,
  setPhase,
  startAuction,
  startRoundEngine,
  undoLastRewardBatch,
  updateDaySchedule,
  updateFeatures,
  updateTemplateLexicon,
  upsertCard,
} from "./admin/service.js";
import { loadEvent } from "./event/repository.js";
import { ensureActiveEvent } from "./event/seed.js";
import { buildLiveState, buildRules } from "./event/snapshot.js";
import {
  buyCard,
  buyP2PListing,
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
} from "./team/service.js";

const admin: Identity = {
  userId: 1,
  displayName: "Админ",
  username: "admin",
  isAdmin: true,
  botSurface: "admin",
};
const player = (userId: number, name: string): Identity => ({
  userId,
  displayName: name,
  username: null,
  isAdmin: false,
  botSurface: "player",
});
const alice = player(101, "Алиса");
const bob = player(102, "Боб");
const carol = player(201, "Кира");
const dave = player(301, "Даня");

let handle: DbHandle;
let eventId: string;
let codeA: string;
let codeB: string;
let codeC: string;
let teamA: string;
let teamB: string;
let teamC: string;

function must<T>(value: T | undefined, label = "fixture"): T {
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

const opts = (actor: Identity, idempotencyKey?: string) => ({ eventId, actor, idempotencyKey });
const dayOneCards = ROVER_SPRINT_TEMPLATE.cards.filter((c) => c.dayAvailable === 1);
const cheapCard = must(dayOneCards[0], "cheapCard");
const secondSlotCard = must(
  dayOneCards.find((c) => c.slotId !== cheapCard.slotId),
  "secondSlotCard",
);
const thirdSlotCard = must(
  dayOneCards.find((c) => c.slotId !== cheapCard.slotId && c.slotId !== secondSlotCard.slotId),
  "thirdSlotCard",
);

beforeAll(async () => {
  handle = await connectPglite(undefined, config.MIGRATIONS_DIR);
  setRuntime({ db: handle.db, hub: new RealtimeHub(() => runtime().db) });
  eventId = await ensureActiveEvent(handle.db, false);
  const a = await createTeam(opts(admin), { name: "Марс-01" });
  const b = await createTeam(opts(admin), { name: "Кратер-04" });
  const c = await createTeam(opts(admin), { name: "Титан-07" });
  [teamA, codeA, teamB, codeB, teamC, codeC] = [
    a.teamId,
    a.joinCode,
    b.teamId,
    b.joinCode,
    c.teamId,
    c.joinCode,
  ];
});

afterAll(async () => {
  runtime().hub.close();
  await handle.close();
});

describe("membership", () => {
  it("first player becomes captain, next one a member", async () => {
    expect(await joinTeam(opts(alice), { code: codeA.toLowerCase(), displayName: "Алиса" })).toEqual({
      teamId: teamA,
      role: "captain",
    });
    expect((await joinTeam(opts(bob), { code: codeA, displayName: "Боб" })).role).toBe("member");
    expect((await joinTeam(opts(carol), { code: codeB, displayName: "Кира" })).role).toBe("captain");
    expect((await joinTeam(opts(dave), { code: codeC, displayName: "Даня" })).role).toBe("captain");
  });

  it("rejects joining a second team", async () => {
    await expect(joinTeam(opts(bob), { code: codeB, displayName: "Боб" })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("hides other teams' join codes from players", async () => {
    const state = await buildLiveState(handle.db, eventId, alice);
    expect(state.viewer).toMatchObject({ teamId: teamA, role: "captain", needsJoin: false });
    expect(state.teams.find((t) => t.id === teamA)?.joinCode).toBe(codeA);
    expect(state.teams.find((t) => t.id === teamB)?.joinCode).toBe("");
  });
});

describe("shop, inventory & undo", () => {
  it("is closed until the admin opens it", async () => {
    await expect(buyCard(opts(alice), cheapCard.id)).rejects.toThrow("Рынок");
    await rewardTeams(opts(admin), {
      teamIds: [teamA, teamB, teamC],
      amount: 20,
      reason: "Лабораторный спринт",
    });
    await setPhase(opts(admin), { phase: "market", minutes: 15 });
  });

  it("only captains buy, members propose and the captain accepts", async () => {
    await expect(buyCard(opts(bob), cheapCard.id)).rejects.toThrow("капитан");
    const { proposalId } = await proposeCard(opts(bob), { cardId: cheapCard.id });
    await resolveProposal(opts(alice), proposalId, true);
    const [team] = await handle.db.select().from(teams).where(eq(teams.id, teamA));
    expect(team?.equipped[cheapCard.slotId]).toBe(cheapCard.id);
    expect(team?.currency).toBe(20 - cheapCard.price);
  });

  it("applies a retried command once", async () => {
    await buyCard(opts(carol, "retry-key-0001"), secondSlotCard.id);
    await buyCard(opts(carol, "retry-key-0001"), secondSlotCard.id);
    const [team] = await handle.db.select().from(teams).where(eq(teams.id, teamB));
    expect(team?.purchasesToday).toBe(1);
  });

  it("sells the last copy to exactly one team under contention", async () => {
    await handle.db.update(cardStock).set({ left: 1 }).where(eq(cardStock.cardId, thirdSlotCard.id));
    const results = await Promise.allSettled([
      buyCard(opts(alice), thirdSlotCard.id),
      buyCard(opts(carol), thirdSlotCard.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [stock] = await handle.db.select().from(cardStock).where(eq(cardStock.cardId, thirdSlotCard.id));
    expect(stock?.left).toBe(0);
  });

  it("undoes the last purchase and restores currency and stock", async () => {
    await buyCard(opts(dave), secondSlotCard.id);
    const before = must((await handle.db.select().from(teams).where(eq(teams.id, teamC)))[0]);
    await undoLastPurchase(opts(dave));
    const after = must((await handle.db.select().from(teams).where(eq(teams.id, teamC)))[0]);
    expect(after.currency).toBe(before.currency + secondSlotCard.price);
    expect(after.purchasesToday).toBe(before.purchasesToday - 1);
  });

  it("unequips to team inventory and re-equips cleanly", async () => {
    await equipFromInventory(opts(alice), { slotId: cheapCard.slotId, cardId: null });
    let [team] = await handle.db.select().from(teams).where(eq(teams.id, teamA));
    expect(team?.equipped[cheapCard.slotId]).toBeNull();
    expect(team?.inventory).toContain(cheapCard.id);

    await equipFromInventory(opts(alice), { slotId: cheapCard.slotId, cardId: cheapCard.id });
    [team] = await handle.db.select().from(teams).where(eq(teams.id, teamA));
    expect(team?.equipped[cheapCard.slotId]).toBe(cheapCard.id);
    expect(team?.inventory).not.toContain(cheapCard.id);
  });
});

describe("P2P market & feature switches", () => {
  it("enforces price corridor, prevents self-buy, and resolves concurrent P2P purchase once", async () => {
    await expect(
      createP2PListing(opts(alice), {
        cardId: cheapCard.id,
        price: 99,
        fromEquippedSlot: cheapCard.slotId,
      }),
    ).rejects.toThrow("Допустимая цена");

    const { listingId } = await createP2PListing(opts(alice), {
      cardId: cheapCard.id,
      price: 3,
      fromEquippedSlot: cheapCard.slotId,
    });

    await expect(buyP2PListing(opts(alice), listingId)).rejects.toThrow("собственный лот");

    const sellerBefore = must((await handle.db.select().from(teams).where(eq(teams.id, teamA)))[0]);
    const race = await Promise.allSettled([
      buyP2PListing(opts(carol), listingId),
      buyP2PListing(opts(dave), listingId),
    ]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const sellerAfter = must((await handle.db.select().from(teams).where(eq(teams.id, teamA)))[0]);
    expect(sellerAfter.currency).toBe(sellerBefore.currency + 3);
  });

  it("blocks P2P listing when feature flag p2pMarket is switched off", async () => {
    await updateFeatures(opts(admin), { p2pMarket: false });
    await expect(createP2PListing(opts(carol), { cardId: secondSlotCard.id, price: 2 })).rejects.toThrow(
      "отключена",
    );
    await updateFeatures(opts(admin), { p2pMarket: true });
  });
});

describe("live auctions with escrow & outbid refunds", () => {
  it("holds leader bid, refunds outbid team, and settles winner item", async () => {
    const legendary = must(ROVER_SPRINT_TEMPLATE.cards.find((c) => c.rarity === "legendary"));
    const { auctionId } = await startAuction(opts(admin), {
      cardId: legendary.id,
      startingPrice: 4,
      durationMinutes: 5,
    });

    const bBefore = must((await handle.db.select().from(teams).where(eq(teams.id, teamB)))[0]);
    await placeAuctionBid(opts(carol), { auctionId, amount: 5 });
    const bMid = must((await handle.db.select().from(teams).where(eq(teams.id, teamB)))[0]);
    expect(bMid.currency).toBe(bBefore.currency - 5);
    expect(bMid.heldCurrency).toBe(5);

    await placeAuctionBid(opts(dave), { auctionId, amount: 7 });
    const bRefunded = must((await handle.db.select().from(teams).where(eq(teams.id, teamB)))[0]);
    expect(bRefunded.currency).toBe(bBefore.currency);
    expect(bRefunded.heldCurrency).toBe(0);

    await closeAuctionNow(opts(admin), auctionId);
    const winner = must((await handle.db.select().from(teams).where(eq(teams.id, teamC)))[0]);
    expect(winner.heldCurrency).toBe(0);
    expect(
      winner.equipped[legendary.slotId] === legendary.id || winner.inventory.includes(legendary.id),
    ).toBe(true);
  });
});

describe("admin studio: card editor, AI draft, quick-fix, turn & shift wizard", () => {
  it("edits card, generates & approves draft, applies quick-fix and turn", async () => {
    const created = await upsertCard(opts(admin), {
      name: "Квантовый гироскоп",
      slotId: "sensors",
      rarity: "rare",
      tier: 3,
      price: 4,
      dayAvailable: 1,
      stats: { speed: 2, traction: 2, payload: -1 },
      trackBonus: 0,
      stock: 2,
    });
    expect(created.cardId).toMatch(/^[a-z0-9-]+$/);

    const draft = await generateMarketDraft(admin.userId, {
      theme: "Арктический вездеход",
      templateId: ROVER_SPRINT_TEMPLATE.id,
      count: 12,
      debuffStrength: "balanced",
      rareSharePercent: 30,
      legendarySharePercent: 15,
      allowedScopes: ["step", "event_shield"],
    });
    expect(draft.cards).toHaveLength(12);
    const pub = await decideMarketDraft(opts(admin), {
      draftId: draft.draftId,
      decision: "approve",
      mode: "append",
    });
    expect(pub.published).toBe(12);

    await applyQuickFix(opts(admin), {
      type: "grant_all",
      amount: 2,
      reason: "Бонус лаборатории",
    });

    await applyTurn(opts(admin));
    await expect(applyTurn(opts(admin))).rejects.toThrow("уже проведён");
    const dayRes = await nextDay(opts(admin));
    expect(dayRes.day).toBe(2);
  });

  it("creates a brand-new shift from the Shift Creator Wizard", async () => {
    const res = await createShiftFromWizard(opts(admin), {
      title: "Марсианский Спринт ЦУ",
      theme: "Роверы в кратере Езеро",
      totalDays: 6,
      teamCount: 3,
      baseTemplateId: "rover-sprint-cu",
      useAiLoreAndCards: true,
      cardCount: 12,
    });
    expect(res.title).toBe("Марсианский Спринт ЦУ");
    const state = await buildLiveState(handle.db, eventId, admin);
    expect(state.teams).toHaveLength(3);
  });
});

describe("dual telegram bots (playerBot & adminBot)", () => {
  it("handles /start, /story, /faq on playerBot and enforces admin guard on adminBot", async () => {
    const sent: Array<{ chatId: unknown; text: string }> = [];
    const playerBot = createPlayerBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", "http://localhost:5173");
    const adminBot = createAdminBot(
      "654321:XYZ-DEF1234ghIkl-zyx57W2v1u123ew22",
      "http://localhost:5173/?surface=admin",
      new Set([1]),
    );

    for (const b of [playerBot, adminBot]) {
      b.botInfo = {
        id: 999,
        is_bot: true,
        first_name: "STEM Bot",
        username: "stem_test_bot",
        can_join_groups: false,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: true,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
        can_manage_bots: false,
        supports_join_request_queries: false,
      };
      b.api.config.use(async (_prev, method, payload) => {
        if (method === "sendMessage") {
          const p = payload as { chat_id?: unknown; text?: string };
          sent.push({ chatId: p.chat_id, text: p.text ?? "" });
        }
        return { ok: true, result: true as never };
      });
    }

    const makeCmd = (id: number, userId: number, text: string) => ({
      update_id: id,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: "private" as const, first_name: "User" },
        from: { id: userId, is_bot: false, first_name: "User" },
        text,
        entities: [{ offset: 0, length: (text.split(" ")[0] ?? text).length, type: "bot_command" as const }],
      },
    });

    await playerBot.handleUpdate(makeCmd(1, 101, "/start"));
    await playerBot.handleUpdate(makeCmd(2, 101, "/story"));
    await playerBot.handleUpdate(makeCmd(3, 101, "/faq"));
    expect(sent.some((m) => m.text.includes("Марсианский Спринт ЦУ"))).toBe(true);
    expect(sent.some((m) => m.text.includes("Памятка по смене"))).toBe(true);

    const beforeAdmin = sent.length;
    await adminBot.handleUpdate(makeCmd(4, 9999, "/start"));
    expect(sent[beforeAdmin]?.text).toContain("Доступ закрыт");

    await adminBot.handleUpdate(makeCmd(5, 1, "/balance"));
    expect(sent[sent.length - 1]?.text).toContain("Индекс баланса");

    await playerBot.handleUpdate(makeCmd(6, 101, "/playground"));
    expect(sent[sent.length - 1]?.text).toContain("0 валюты");

    await adminBot.handleUpdate(makeCmd(7, 1, "/pulse"));
    expect(sent[sent.length - 1]?.text).toContain("Пульс зала");
  });

  it("returns direct JSON sendMessage payload from webhook HTTP response without outbound Bot API call", async () => {
    const { Hono } = await import("hono");
    const { createBotWebhookHandler } = await import("../bot/index.js");
    const directAdminBot = createAdminBot(
      "654321:XYZ-DEF1234ghIkl-zyx57W2v1u123ew22",
      "https://stem-bot.renat.site/?surface=admin",
      new Set([857932226]),
    );
    const app = new Hono();
    app.post(
      "/telegram/admin-webhook",
      createBotWebhookHandler(directAdminBot, "test_secret_token_32_characters_ok"),
    );

    const unauth = await app.request("/telegram/admin-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(unauth.status).toBe(401);

    const res = await app.request("/telegram/admin-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test_secret_token_32_characters_ok",
      },
      body: JSON.stringify({
        update_id: 100,
        message: {
          message_id: 10,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 857932226, type: "private", first_name: "Admin" },
          from: { id: 857932226, is_bot: false, first_name: "Admin" },
          text: "/start",
          entities: [{ offset: 0, length: 6, type: "bot_command" }],
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { method?: string; chat_id?: number; text?: string };
    expect(body.method).toBe("sendMessage");
    expect(body.chat_id).toBe(857932226);
  });
});

describe("Engine 3.0 five-phone program, diagnosis, reward undo & constructor APIs", () => {
  it("enforces 5-phone lever ownership, reveals mission with currencyDelta=0, runs diagnosis & undoes batch reward", async () => {
    const created = await createTeam({ eventId, actor: admin }, { name: "Экипаж Пять" });
    const c0 = player(501, "Аня");
    const crew = [c0, player(502, "Макс"), player(503, "Илья"), player(504, "Даша"), player(505, "Егор")];
    for (const member of crew) {
      await joinTeam({ eventId, actor: member }, { code: created.joinCode, displayName: member.displayName });
    }

    await rewardTeams(
      { eventId, actor: admin },
      { teamIds: [created.teamId], amount: 4, reason: "Замер на стенде" },
    );
    let state = await buildLiveState(handle.db, eventId, admin);
    expect(state.teams.find((t) => t.id === created.teamId)?.currency).toBe(4);
    expect(state.gameState.canUndoLastReward).toBe(true);

    await undoLastRewardBatch({ eventId, actor: admin });
    state = await buildLiveState(handle.db, eventId, admin);
    expect(state.teams.find((t) => t.id === created.teamId)?.currency).toBe(0);

    await rewardTeams(
      { eventId, actor: admin },
      { teamIds: [created.teamId], amount: 3, reason: "Защита расчёта" },
    );

    await startRoundEngine(
      { eventId, actor: admin },
      { engine: "mission", durationSeconds: 120, conditionId: "calm" },
    );

    const p0State = await buildLiveState(handle.db, eventId, c0);
    const myLever = p0State.viewer.assignedLevers?.[0] ?? 0;
    const forbiddenLever = (myLever + 1) % 5;

    await expect(
      submitProgramOrder({ eventId, actor: c0 }, { leverIndex: forbiddenLever, value: "normal" }),
    ).rejects.toThrow(DomainError);

    for (const member of crew) {
      const mState = await buildLiveState(handle.db, eventId, member);
      const lever = mState.viewer.assignedLevers?.[0] ?? 0;
      const val = lever === 0 ? "detour" : lever === 1 || lever === 2 ? "normal" : lever === 3 ? true : "B";
      await submitProgramOrder({ eventId, actor: member }, { leverIndex: lever, value: val });
    }

    await pingTeamSlot({ eventId, actor: c0 }, { slotIndex: 4 });
    await saveTransferNote({ eventId, actor: c0 }, { note: "Проверим ток сервопривода мультиметром" });

    const beforeReveal = await buildLiveState(handle.db, eventId, c0);
    const teamBefore = beforeReveal.teams.find((t) => t.id === created.teamId);
    expect(teamBefore?.roundState?.readySlots).toEqual([0, 1, 2, 3, 4]);
    expect(teamBefore?.roundState?.pingedSlots).toContain(4);
    expect(teamBefore?.currency).toBe(3);

    await revealMissionRound({ eventId, actor: admin }, { conditionId: "calm" });

    const afterReveal = await buildLiveState(handle.db, eventId, c0);
    const teamAfter = afterReveal.teams.find((t) => t.id === created.teamId);
    expect(afterReveal.gameState.roundMode).toBe("revealed");
    expect(afterReveal.gameState.revealedConditionId).toBe("calm");
    expect(teamAfter?.currency).toBe(3);
    expect(teamAfter?.roundState?.lastRoundPoints).toBeGreaterThan(0);

    await nextDay({ eventId, actor: admin });
    await startRoundEngine({ eventId, actor: admin }, { engine: "diagnosis", durationSeconds: 180 });

    const evtRow = await loadEvent(handle.db, eventId);
    const clientRules = buildRules(evtRow, false);
    expect(clientRules.currentDiagnosisDay?.secretHypothesisId).toBe("hidden");

    const firstProbeId = clientRules.currentDiagnosisDay?.probes[0]?.id ?? "p1";
    const probeRes = await runDiagnosisProbe({ eventId, actor: c0 }, { probeId: firstProbeId });
    expect(probeRes.usedProbes).toEqual([firstProbeId]);

    const adminRules = buildRules(evtRow, true);
    const secretHyp = adminRules.currentDiagnosisDay?.secretHypothesisId ?? "h3";
    const verdict = await submitDiagnosisVerdict({ eventId, actor: c0 }, { hypothesisId: secretHyp });
    expect(verdict).toEqual({ correct: true, points: 2, currencyDelta: 0 });

    const afterDiag = await buildLiveState(handle.db, eventId, c0);
    expect(afterDiag.teams.find((t) => t.id === created.teamId)?.currency).toBe(3);

    await updateTemplateLexicon(
      { eventId, actor: admin },
      { objectName: "Автономный катер", currencyLabel: "Кредиты лаборатории" },
    );
    await updateDaySchedule(
      { eventId, actor: admin },
      {
        totalDays: 4,
        daySchedule: [
          { day: 1, engine: "mission" },
          { day: 2, engine: "diagnosis" },
          { day: 3, engine: "mission" },
          { day: 4, engine: "legacy_track" },
        ],
      },
    );
    const paretoRes = await applyParetoFix({ eventId, actor: admin }, { day: 1 });
    expect(paretoRes.suggestedMinA).toBeGreaterThan(0);

    const updatedRow = await loadEvent(handle.db, eventId);
    const updatedRules = buildRules(updatedRow, false);
    expect(updatedRules.lexicon?.objectName).toBe("Автономный катер");
    expect(updatedRules.template.totalDays).toBe(4);
  });
});
