import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { analyzeLiveBalance } from "./advisor.js";
import {
  AUCTION_ANTI_SNIPE_EXTEND_MS,
  calculateTeamStats,
  evaluateAuctionBid,
  evaluateBuyState,
  previewCardEffect,
  resolveBoardTurn,
  validateGameBalance,
  validateP2PPrice,
} from "./engine.js";
import {
  assignMemberLevers,
  defaultPowerCircuit,
  evaluateDiagnosisVerdict,
  evaluateDualForecast,
  evaluateProbeObservation,
  resolveDiagnosisDay,
  resolveLexicon,
  resolveMissionDay,
  validateParetoStrategies,
} from "./engine3.js";
import { validateGeneratedMarket } from "./market-generation.js";
import { DEFAULT_TEMPLATES, NEUROFAUNA_TEMPLATE, ROVER_SPRINT_TEMPLATE } from "./presets.js";
import { GameTemplateSchema, type Team, TeamSchema } from "./schema.js";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return TeamSchema.parse({
    id: "team-1",
    name: "КБ Север",
    monogram: "К1",
    joinCode: "RV0001",
    captainUsername: "Алиса",
    members: ["А", "Б"],
    currency: 10,
    heldCurrency: 0,
    trackPosition: 1,
    boardPosition: 1,
    purchasesToday: 0,
    equippedCards: {},
    inventory: [],
    badges: [],
    activePerkId: null,
    statModifiers: {},
    ...overrides,
  });
}

describe("presets & rover sprint", () => {
  for (const preset of DEFAULT_TEMPLATES) {
    it(`${preset.id} matches GameTemplateSchema and has valid references`, () => {
      const parsed = GameTemplateSchema.parse(preset);
      const slotIds = new Set(parsed.slots.map((s) => s.id));
      const statIds = new Set(parsed.stats.map((s) => s.id));
      expect(parsed.cards.length).toBeGreaterThanOrEqual(parsed.slots.length * 2);
      for (const card of parsed.cards) {
        expect(slotIds.has(card.slotId)).toBe(true);
        for (const key of Object.keys(card.stats)) {
          expect(statIds.has(key)).toBe(true);
        }
      }
    });
  }

  it("rover-sprint-cu has 6 days, 6 engineering slots, and full day briefings", () => {
    expect(ROVER_SPRINT_TEMPLATE.totalDays).toBe(6);
    expect(ROVER_SPRINT_TEMPLATE.objectRig).toBe("rover");
    expect(ROVER_SPRINT_TEMPLATE.slots).toHaveLength(6);
    expect(ROVER_SPRINT_TEMPLATE.dayBriefings.length).toBe(7);
  });
});

describe("calculateTeamStats, step breakdown & legendary scopes", () => {
  it("sums equipped cards, active perk, modifiers, catch-up bonus, and legendary synergy", () => {
    const team = makeTeam({
      trackPosition: 2,
      equippedCards: {
        chassis: "titan-exoframe",
        drive: "kevlar-tracks",
        power: "regen-cell-pack",
        cargo: "scissor-lift-arm",
      },
      activePerkId: "heavy-logistics",
      statModifiers: { speed: 1 },
    });
    const computed = calculateTeamStats(team, ROVER_SPRINT_TEMPLATE, 10);
    expect(computed.hasEventShield).toBe(true);
    expect(computed.economyBonus).toBe(1);
    expect(computed.perkConditionMet).toBe(true);
    expect(computed.step.parts.some((p) => p.key === "slot-synergy" && p.met)).toBe(true);
    expect(computed.step.parts.some((p) => p.key === "catch-up" && p.met)).toBe(true);
    expect(computed.step.total).toBeGreaterThanOrEqual(6);
  });

  it("flags unmet perk conditions and ignores unknown card ids", () => {
    const team = makeTeam({
      equippedCards: { head: "non-existent" },
      activePerkId: "lightning",
    });
    const computed = calculateTeamStats(team, NEUROFAUNA_TEMPLATE);
    expect(computed.perkConditionMet).toBe(false);
    expect(computed.step.total).toBe(1);
  });
});

describe("previewCardEffect & evaluateBuyState", () => {
  it("detects lost step blocks when replacing a card lowers a threshold stat", () => {
    const team = makeTeam({
      equippedCards: {
        drive: "slick-wheels",
        sensors: "ir-line-array",
      },
    });
    const walker = ROVER_SPRINT_TEMPLATE.cards.find((c) => c.id === "klann-walker");
    if (!walker) throw new Error("Missing klann-walker");
    const preview = previewCardEffect(team, walker, ROVER_SPRINT_TEMPLATE);
    expect(preview.lostParts.some((p) => p.statId === "speed")).toBe(true);
    expect(preview.gainedParts.some((p) => p.statId === "traction")).toBe(true);
  });

  it("prioritizes closed, soldOut, limit, funds, propose and buy states", () => {
    const card = ROVER_SPRINT_TEMPLATE.cards[0];
    if (!card) throw new Error("Missing card");
    const team = makeTeam({ currency: 1 });
    expect(
      evaluateBuyState({
        template: ROVER_SPRINT_TEMPLATE,
        team,
        card,
        stockLeft: 0,
        isOpen: true,
        dailyLimit: 2,
        isCaptain: true,
      }).kind,
    ).toBe("soldOut");
    expect(
      evaluateBuyState({
        template: ROVER_SPRINT_TEMPLATE,
        team,
        card,
        stockLeft: 2,
        isOpen: true,
        dailyLimit: 2,
        isCaptain: true,
      }).kind,
    ).toBe("funds");
  });
});

describe("resolveBoardTurn declarative polygon mechanics", () => {
  const sandSlope = ROVER_SPRINT_TEMPLATE.boardCells.find((c) => c.position === 19);
  if (!sandSlope) throw new Error("Missing sandSlope cell");

  it("rewards team when stat meets challenge threshold", () => {
    const team = makeTeam({
      trackPosition: 15,
      equippedCards: { chassis: "articulated-deck", drive: "klann-walker" },
    });
    const res = resolveBoardTurn({
      team,
      template: ROVER_SPRINT_TEMPLATE,
      cellOverride: sandSlope,
    });
    expect(res.passed).toBe(true);
    expect(res.eventTrackDelta).toBe(2);
  });

  it("applies penalty on failure, allows buyoff, or shields with legendary exoframe", () => {
    const weakTeam = makeTeam({ trackPosition: 15, currency: 5 });
    const failed = resolveBoardTurn({
      team: weakTeam,
      template: ROVER_SPRINT_TEMPLATE,
      cellOverride: sandSlope,
      useBuyoff: false,
    });
    expect(failed.passed).toBe(false);
    expect(failed.canBuyoff).toBe(true);
    expect(failed.eventTrackDelta).toBe(-2);

    const boughtOff = resolveBoardTurn({
      team: weakTeam,
      template: ROVER_SPRINT_TEMPLATE,
      cellOverride: sandSlope,
      useBuyoff: true,
    });
    expect(boughtOff.buyoffUsed).toBe(true);
    expect(boughtOff.eventTrackDelta).toBe(0);
    expect(boughtOff.nextCurrency).toBe(5 - (sandSlope.buyoffCost ?? 3));

    const shieldedTeam = makeTeam({
      trackPosition: 15,
      equippedCards: { chassis: "titan-exoframe" },
    });
    const shielded = resolveBoardTurn({
      team: shieldedTeam,
      template: ROVER_SPRINT_TEMPLATE,
      cellOverride: sandSlope,
    });
    expect(shielded.shielded).toBe(true);
    expect(shielded.eventTrackDelta).toBe(0);
  });
});

describe("P2P market & Auction property-based invariants (fast-check)", () => {
  it("enforces P2P price corridor and fee conservation", () => {
    const card = ROVER_SPRINT_TEMPLATE.cards.find((c) => c.price === 4);
    if (!card) throw new Error("Missing card");
    const features = { ...ROVER_SPRINT_TEMPLATE.features, p2pFeePercent: 10 };
    expect(validateP2PPrice(card, 1, features, "Энергоячейки").ok).toBe(false);
    expect(validateP2PPrice(card, 20, features, "Энергоячейки").ok).toBe(false);
    const valid = validateP2PPrice(card, 5, features, "Энергоячейки");
    expect(valid.ok).toBe(true);
    expect(valid.sellerReceives + valid.fee).toBe(5);
  });

  it("property: auction bids strictly increase, conserve escrow+cash, and extend on anti-snipe", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.array(
          fc.record({
            teamIdx: fc.integer({ min: 0, max: 3 }),
            increment: fc.integer({ min: 0, max: 5 }),
            msBeforeEnd: fc.integer({ min: 1_000, max: 40_000 }),
          }),
          { minLength: 1, maxLength: 25 },
        ),
        (startingPrice, steps) => {
          const teams = [0, 1, 2, 3].map((i) => ({
            id: `t-${i}`,
            currency: 200,
            held: 0,
          }));
          const initialTotalMoney = teams.reduce((s, t) => s + t.currency + t.held, 0);

          let currentBid = 0;
          let leaderTeamId: string | null = null;
          let endsAtMs = 100_000;

          for (const step of steps) {
            const bidder = teams[step.teamIdx];
            if (!bidder) continue;
            const nowMs = endsAtMs - step.msBeforeEnd;
            const candidateBid = (currentBid > 0 ? currentBid : startingPrice - 1) + step.increment;

            const check = evaluateAuctionBid({
              auction: {
                status: "open",
                startingPrice,
                currentBid,
                leaderTeamId,
                endsAt: new Date(endsAtMs).toISOString(),
              },
              bidderTeam: { id: bidder.id, currency: bidder.currency },
              amount: candidateBid,
              nowMs,
              currencyName: "⚡",
            });

            if (check.ok) {
              expect(candidateBid).toBeGreaterThan(currentBid);
              if (check.refundTeamId) {
                const prev = teams.find((t) => t.id === check.refundTeamId);
                if (!prev) throw new Error("Missing refund team");
                prev.currency += check.refundAmount;
                prev.held -= check.refundAmount;
                expect(prev.held).toBe(0);
              }
              bidder.currency -= candidateBid;
              bidder.held += candidateBid;
              currentBid = candidateBid;
              leaderTeamId = bidder.id;
              endsAtMs = check.nextEndsAtMs;

              if (step.msBeforeEnd < 15_000) {
                expect(check.extended).toBe(true);
                expect(endsAtMs).toBe(nowMs + AUCTION_ANTI_SNIPE_EXTEND_MS);
              }
            }

            for (const t of teams) {
              expect(t.currency).toBeGreaterThanOrEqual(0);
              expect(t.held).toBeGreaterThanOrEqual(0);
            }
            const totalNow = teams.reduce((s, t) => s + t.currency + t.held, 0);
            expect(totalNow).toBe(initialTotalMoney);
          }
        },
      ),
      { numRuns: 120 },
    );
  });
});

describe("validateGameBalance, generated market & live advisor", () => {
  it("reports low slot coverage and keeps score in 0..100", () => {
    const broken = {
      ...ROVER_SPRINT_TEMPLATE,
      cards: ROVER_SPRINT_TEMPLATE.cards.slice(0, 2),
    };
    const report = validateGameBalance(broken);
    expect(report.isBalanced).toBe(false);
    expect(report.issues.some((i) => i.code === "LOW_SLOT_COVERAGE")).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("normalizes generated cards and rejects duplicate names", () => {
    const sample = {
      cards: ROVER_SPRINT_TEMPLATE.cards.slice(0, 6).map((c, idx) => ({
        ...c,
        id: idx === 0 ? "Кириллица ID!" : c.id,
      })),
    };
    const res = validateGeneratedMarket(sample, ROVER_SPRINT_TEMPLATE, 6);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.cards[0]?.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("live advisor detects runaway leader and currency famine with actionable quick fixes", () => {
    const teams = [
      makeTeam({ id: "t1", name: "Лидер", trackPosition: 18, currency: 0 }),
      makeTeam({ id: "t2", name: "Второй", trackPosition: 4, currency: 0 }),
      makeTeam({ id: "t3", name: "Третий", trackPosition: 3, currency: 1 }),
    ];
    const dashboard = analyzeLiveBalance({
      template: {
        ...ROVER_SPRINT_TEMPLATE,
        features: { ...ROVER_SPRINT_TEMPLATE.features, catchUpBonus: false },
      },
      gameState: {
        activeTemplateId: ROVER_SPRINT_TEMPLATE.id,
        currentDay: 2,
        currentPoint: 2,
        currentPhase: "market",
        purchasePhaseActive: true,
        dailyPurchaseLimit: 2,
        secondsLeft: 600,
        phaseEndsAt: null,
        rulesVersion: 1,
        rulesUpdatedNote: "",
        cardStockLeft: {},
        cardSoldTo: {},
      },
      teams,
    });
    expect(dashboard.alerts.some((a) => a.id === "runaway-leader")).toBe(true);
    expect(dashboard.alerts.some((a) => a.id === "currency-famine")).toBe(true);
    expect(dashboard.alerts.some((a) => a.fix !== undefined)).toBe(true);
  });
});

describe("Engine 3.0 mission, powerCircuit, diagnosis & Pareto validator", () => {
  it("preserves non-dominated 3/2 vs 4/1 symmetric dilemma and enforces currencyDelta = 0", () => {
    const day = resolveMissionDay(ROVER_SPRINT_TEMPLATE, 4);
    const circuit = defaultPowerCircuit(ROVER_SPRINT_TEMPLATE);
    const stats = { speed: 4, traction: 5, payload: 4 };

    const safeForecast = evaluateDualForecast({
      stats,
      day,
      orders: { routeId: "short", paceA: "normal", paceB: "normal", extraCargo: false, reserveTarget: "A" },
      circuit,
      equippedLoad: 3,
    });
    expect(safeForecast.map((f) => f.totalPoints)).toEqual([3, 2]);
    expect(safeForecast.every((f) => f.currencyDelta === 0)).toBe(true);

    const riskForecast = evaluateDualForecast({
      stats,
      day,
      orders: { routeId: "detour", paceA: "normal", paceB: "normal", extraCargo: true, reserveTarget: "B" },
      circuit,
      equippedLoad: 3,
    });
    expect(riskForecast.map((f) => f.totalPoints)).toEqual([4, 1]);
    expect(riskForecast.every((f) => f.currencyDelta === 0)).toBe(true);
  });

  it("triggers powerCircuit cutoff on excessive overload and cools down on pause", () => {
    const day = resolveMissionDay(ROVER_SPRINT_TEMPLATE, 4);
    const circuit = defaultPowerCircuit(ROVER_SPRINT_TEMPLATE);
    const stats = { speed: 8, traction: 9, payload: 8 };

    const overloaded = evaluateDualForecast({
      stats,
      day,
      orders: { routeId: "short", paceA: "fast", paceB: "fast", extraCargo: true, reserveTarget: "A" },
      circuit,
      equippedLoad: 4,
    });
    expect(overloaded[0]?.sectorA.trippedCircuit).toBe(true);
    expect(overloaded[0]?.sectorA.points).toBe(0);

    const cooledOnA = evaluateDualForecast({
      stats,
      day,
      orders: { routeId: "short", paceA: "pause", paceB: "normal", extraCargo: false, reserveTarget: "B" },
      circuit,
      equippedLoad: 4,
    });
    expect(cooledOnA[0]?.sectorA.trippedCircuit).toBe(false);
    expect(cooledOnA[0]?.sectorB.passed).toBe(true);
  });

  it("eliminates incompatible hypotheses via probes, strips secrets for clients, and scores 3 - probes", () => {
    const fullDiag = resolveDiagnosisDay(ROVER_SPRINT_TEMPLATE, 3, false);
    const publicDiag = resolveDiagnosisDay(ROVER_SPRINT_TEMPLATE, 3, true);
    expect(publicDiag.secretHypothesisId).toBe("hidden");

    const step1 = evaluateProbeObservation(fullDiag, ["p1"]);
    expect(Object.keys(step1.eliminatedHypotheses).length).toBeGreaterThan(0);
    expect(step1.eliminatedHypotheses[fullDiag.secretHypothesisId]).toBeUndefined();

    const winOneProbe = evaluateDiagnosisVerdict({
      day: fullDiag,
      hypothesisId: fullDiag.secretHypothesisId,
      usedProbesCount: 1,
    });
    expect(winOneProbe).toEqual({ correct: true, points: 2, currencyDelta: 0 });

    const wrongVerdict = evaluateDiagnosisVerdict({
      day: fullDiag,
      hypothesisId: "h1",
      usedProbesCount: 1,
    });
    expect(wrongVerdict).toEqual({ correct: false, points: 0, currencyDelta: 0 });
  });

  it("detects Pareto dominance when threshold is skewed and rotates levers across 1..5 crew members", () => {
    const day = resolveMissionDay(ROVER_SPRINT_TEMPLATE, 4);
    const circuit = defaultPowerCircuit(ROVER_SPRINT_TEMPLATE);
    const stats = { speed: 4, traction: 5, payload: 4 };

    const brokenCheck = validateParetoStrategies({
      day: {
        ...day,
        routesA: day.routesA.map((r, i) => (i === 0 ? { ...r, min: 8 } : r)),
      },
      referenceStats: stats,
      circuit,
    });
    expect(brokenCheck.balanced).toBe(false);
    expect(brokenCheck.suggestedMinA).toBe(7);

    const balancedCheck = validateParetoStrategies({ day, referenceStats: stats, circuit });
    expect(balancedCheck.balanced).toBe(true);

    const day1Seats = [0, 1, 2, 3, 4].flatMap((idx) => assignMemberLevers(idx, 5, 1));
    expect(new Set(day1Seats).size).toBe(5);
    expect(resolveLexicon(NEUROFAUNA_TEMPLATE).currencyUnit).toBe("ДНК");
  });
});
