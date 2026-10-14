import { describe, expect, it } from "vitest";
import { calculateTeamStats, evaluateBuyState, previewCardEffect, validateGameBalance } from "./engine.js";
import {
  DEFAULT_TEMPLATES,
  NEURO_AIRSHIP_TEMPLATE,
  NEUROFAUNA_TEMPLATE,
  STARTUP_DAY_TEMPLATE,
} from "./presets.js";
import { GameTemplateSchema, type Team } from "./schema.js";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Test",
    monogram: "T1",
    joinCode: "TX01",
    captainUsername: "captain",
    members: ["А", "Б"],
    currency: 12,
    trackPosition: 1,
    boardPosition: 1,
    purchasesToday: 0,
    equippedCards: {},
    activePerkId: null,
    statModifiers: {},
    ...overrides,
  };
}

describe("presets", () => {
  it.each(DEFAULT_TEMPLATES.map((t) => [t.id, t]))("%s matches GameTemplateSchema", (_, template) => {
    expect(GameTemplateSchema.safeParse(template).success).toBe(true);
  });

  it("every card references an existing slot and stat", () => {
    for (const template of DEFAULT_TEMPLATES) {
      const slotIds = new Set(template.slots.map((s) => s.id));
      const statIds = new Set(template.stats.map((s) => s.id));
      for (const card of template.cards) {
        expect(slotIds.has(card.slotId)).toBe(true);
        for (const statId of Object.keys(card.stats)) expect(statIds.has(statId)).toBe(true);
      }
    }
  });
});

describe("calculateTeamStats & step breakdown", () => {
  it("sums equipped cards, active perk and admin modifiers per stat", () => {
    const team = makeTeam({
      equippedCards: { head: "lion-head", body: "lion-body", back: null },
      activePerkId: "lightning",
      statModifiers: { survival: 2 },
    });

    const stats = calculateTeamStats(team, NEUROFAUNA_TEMPLATE);

    expect(stats.byPart).toEqual({ speed: 1, strength: 3, survival: -1 });
    expect(stats.byPerk).toEqual({ speed: 1, strength: 0, survival: 0 });
    expect(stats.byModifier).toEqual({ speed: 0, strength: 0, survival: 2 });
    expect(stats.total).toEqual({ speed: 2, strength: 3, survival: 1 });
  });

  it("computes step breakdown from thresholds and perk bonus", () => {
    const team = makeTeam({
      equippedCards: {
        head: "lion-head",
        body: "shark-body",
        front: "scorpion-claws",
        tail: "crocodile-tail",
        special: "wasp-sting",
      },
      activePerkId: "massive",
    });

    const stats = calculateTeamStats(team, NEUROFAUNA_TEMPLATE);
    expect(stats.total.strength).toBeGreaterThanOrEqual(5);
    expect(stats.step.total).toBe(4);
  });

  it("flags unmet perk conditions", () => {
    const team = makeTeam({ activePerkId: "lightning" });
    expect(calculateTeamStats(team, NEUROFAUNA_TEMPLATE).perkConditionMet).toBe(false);
  });

  it("ignores unknown card ids", () => {
    const team = makeTeam({ equippedCards: { head: "missing-card" } });
    expect(calculateTeamStats(team, NEUROFAUNA_TEMPLATE).total).toEqual({
      speed: 0,
      strength: 0,
      survival: 0,
    });
  });
});

describe("previewCardEffect & evaluateBuyState", () => {
  it("detects lost step blocks when replacing a card lowers a threshold stat", () => {
    const team = makeTeam({
      equippedCards: {
        head: "lion-head",
        body: "shark-body",
        front: "scorpion-claws",
        tail: "crocodile-tail",
        special: "wasp-sting",
      },
      activePerkId: "massive",
    });
    const reptileCard = NEUROFAUNA_TEMPLATE.cards.find((c) => c.id === "reptile-skin");
    if (!reptileCard) throw new Error("reptile-skin card missing");
    const preview = previewCardEffect(team, reptileCard, NEUROFAUNA_TEMPLATE);

    expect(preview.replacedCard?.id).toBe("shark-body");
    expect(preview.stepDelta).toBeLessThan(0);
    expect(preview.lostParts.length).toBeGreaterThan(0);
  });

  it("prioritizes soldOut, limit, funds, propose and buy states", () => {
    const team = makeTeam({ currency: 10, purchasesToday: 0 });
    const card = STARTUP_DAY_TEMPLATE.cards[0];
    if (!card) throw new Error("startup card missing");

    expect(
      evaluateBuyState({
        template: STARTUP_DAY_TEMPLATE,
        team,
        card,
        stockLeft: 0,
        soldToTeam: "Тайга-04",
        isOpen: true,
        dailyLimit: 2,
        isCaptain: true,
      }).kind,
    ).toBe("soldOut");

    expect(
      evaluateBuyState({
        template: STARTUP_DAY_TEMPLATE,
        team,
        card,
        stockLeft: 2,
        isOpen: true,
        dailyLimit: 2,
        isCaptain: false,
      }).kind,
    ).toBe("propose");
  });
});

describe("validateGameBalance", () => {
  it("reports low slot coverage as an error", () => {
    const report = validateGameBalance({
      ...NEURO_AIRSHIP_TEMPLATE,
      cards: NEURO_AIRSHIP_TEMPLATE.cards.slice(0, 1),
    });
    expect(report.isBalanced).toBe(false);
    expect(report.issues.some((i) => i.code === "LOW_SLOT_COVERAGE")).toBe(true);
  });

  it("keeps score within 0..100", () => {
    for (const template of DEFAULT_TEMPLATES) {
      const { score } = validateGameBalance(template);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
