import { describe, expect, it } from "vitest";
import { calculateTeamStats, validateGameBalance } from "./engine.js";
import { DEFAULT_TEMPLATES, NEURO_AIRSHIP_TEMPLATE, NEUROFAUNA_TEMPLATE } from "./presets.js";
import { GameTemplateSchema, type Team } from "./schema.js";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Test",
    captainUsername: "captain",
    currency: 0,
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

describe("calculateTeamStats", () => {
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
