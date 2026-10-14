import { NEUROFAUNA_TEMPLATE } from "@stem/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectPglite, type DbHandle } from "../db/client.js";
import { cardStock, teams } from "../db/schema.js";
import { RealtimeHub } from "../realtime/hub.js";
import { config } from "../shared/config.js";
import { DomainError } from "../shared/errors.js";
import type { Identity } from "../shared/identity.js";
import { runtime, setRuntime } from "../shared/runtime.js";
import { applyTurn, createTeam, rewardTeams, setPhase } from "./admin/service.js";
import { ensureActiveEvent } from "./event/seed.js";
import { buildLiveState } from "./event/snapshot.js";
import { buyCard, joinTeam, proposeCard, resolveProposal, undoLastPurchase } from "./team/service.js";

const admin: Identity = { userId: 1, displayName: "Админ", username: "admin", isAdmin: true };
const player = (userId: number, name: string): Identity => ({
  userId,
  displayName: name,
  username: null,
  isAdmin: false,
});
const alice = player(101, "Алиса");
const bob = player(102, "Боб");
const carol = player(201, "Кира");

let handle: DbHandle;
let eventId: string;
let codeA: string;
let codeB: string;
let teamA: string;
let teamB: string;

const opts = (actor: Identity, idempotencyKey?: string) => ({ eventId, actor, idempotencyKey });
const cheapCard = NEUROFAUNA_TEMPLATE.cards.find((c) => c.dayAvailable === 1 && c.price <= 2);

beforeAll(async () => {
  handle = await connectPglite(undefined, config.MIGRATIONS_DIR);
  setRuntime({ db: handle.db, hub: new RealtimeHub(() => runtime().db) });
  eventId = await ensureActiveEvent(handle.db, false);
  const a = await createTeam(opts(admin), { name: "Альфа" });
  const b = await createTeam(opts(admin), { name: "Бета" });
  [teamA, codeA, teamB, codeB] = [a.teamId, a.joinCode, b.teamId, b.joinCode];
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

describe("market", () => {
  it("is closed until the admin opens it", async () => {
    await expect(buyCard(opts(alice), cheapCard?.id ?? "")).rejects.toThrow("Рынок");
    await rewardTeams(opts(admin), { teamIds: [teamA, teamB], amount: 10, reason: "Учебный блок" });
    await setPhase(opts(admin), { phase: "market", minutes: 10 });
  });

  it("only captains buy, members propose and the captain accepts", async () => {
    const card = cheapCard;
    if (!card) throw new Error("no cheap card");
    await expect(buyCard(opts(bob), card.id)).rejects.toThrow("капитан");
    const { proposalId } = await proposeCard(opts(bob), card.id);
    await resolveProposal(opts(alice), proposalId, true);
    const [team] = await handle.db.select().from(teams).where(eq(teams.id, teamA));
    expect(team?.equipped[card.slotId]).toBe(card.id);
    expect(team?.currency).toBe(10 - card.price);
  });

  it("applies a retried command once", async () => {
    const card = NEUROFAUNA_TEMPLATE.cards.find(
      (c) => c.dayAvailable === 1 && c.slotId !== cheapCard?.slotId,
    );
    if (!card) throw new Error("no card");
    await buyCard(opts(carol, "retry-key-0001"), card.id);
    await buyCard(opts(carol, "retry-key-0001"), card.id);
    const [team] = await handle.db.select().from(teams).where(eq(teams.id, teamB));
    expect(team?.purchasesToday).toBe(1);
  });

  it("sells the last copy to exactly one team under contention", async () => {
    const card = NEUROFAUNA_TEMPLATE.cards.find(
      (c) => c.dayAvailable === 1 && c.slotId !== cheapCard?.slotId && c.price <= 5,
    );
    if (!card) throw new Error("no card");
    await handle.db.update(cardStock).set({ left: 1 }).where(eq(cardStock.cardId, card.id));
    const results = await Promise.allSettled([buyCard(opts(alice), card.id), buyCard(opts(carol), card.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [stock] = await handle.db.select().from(cardStock).where(eq(cardStock.cardId, card.id));
    expect(stock?.left).toBe(0);
  });

  it("undoes the last purchase and restores currency and stock", async () => {
    const before = (await handle.db.select().from(teams).where(eq(teams.id, teamB)))[0];
    await undoLastPurchase(opts(carol));
    const after = (await handle.db.select().from(teams).where(eq(teams.id, teamB)))[0];
    expect((after?.currency ?? 0) > (before?.currency ?? 0)).toBe(true);
    expect(after?.purchasesToday).toBe((before?.purchasesToday ?? 0) - 1);
  });
});

describe("turn", () => {
  it("moves every team once per day", async () => {
    await applyTurn(opts(admin));
    await expect(applyTurn(opts(admin))).rejects.toThrow("уже применён");
    const state = await buildLiveState(handle.db, eventId, admin);
    expect(state.gameState.currentPhase).toBe("summary");
    expect(state.teams.every((t) => t.trackPosition > 1)).toBe(true);
    expect(state.feed.some((f) => f.kind === "step")).toBe(true);
  });

  it("bumps the event version on every change", async () => {
    const first = await buildLiveState(handle.db, eventId, admin);
    await rewardTeams(opts(admin), { teamIds: [teamA], amount: 1, reason: "Бонус за темп" });
    const second = await buildLiveState(handle.db, eventId, admin);
    expect(second.version).toBe(first.version + 1);
  });
});
