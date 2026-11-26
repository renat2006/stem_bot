import { z } from "zod";
import { type BalanceReport, validateGameBalance } from "./engine.js";
import {
  type CardItem,
  CardItemSchema,
  CardRaritySchema,
  DayScheduleItemSchema,
  EffectScopeSchema,
  FeatureFlagsSchema,
  type GameTemplate,
  ImageIdSchema,
  LoreBriefingSchema,
} from "./schema.js";

export const MarketGenerationInputSchema = z.object({
  theme: z.string().trim().min(3).max(300),
  templateId: z.string().min(1).max(80).default("rover-sprint-cu"),
  count: z.number().int().min(6).max(48).default(18),
  debuffStrength: z.enum(["mild", "balanced", "strict"]).default("balanced"),
  rareSharePercent: z.number().int().min(10).max(50).default(30),
  legendarySharePercent: z.number().int().min(5).max(25).default(15),
  allowedScopes: z.array(EffectScopeSchema).default(["step", "event_shield", "economy", "slot_synergy"]),
});

export const LoreGenerationInputSchema = z.object({
  theme: z.string().trim().min(3).max(300),
  totalDays: z.number().int().min(1).max(14),
});

export const ShiftWizardInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  theme: z.string().trim().min(3).max(300),
  totalDays: z.number().int().min(2).max(10).default(6),
  teamCount: z.number().int().min(2).max(20).default(4),
  coverId: ImageIdSchema.optional(),
  daySchedule: z.array(DayScheduleItemSchema).max(10).optional(),
  cards: z.array(CardItemSchema).min(1).max(150).optional(),
  teamNames: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  features: FeatureFlagsSchema.pick({
    p2pMarket: true,
    auctions: true,
    slotInventory: true,
    storyBriefings: true,
    dayEvents: true,
    catchUpBonus: true,
  })
    .partial()
    .optional(),
  baseTemplateId: z.string().default("rover-sprint-cu"),
  useAiLoreAndCards: z.boolean().default(false),
  cardCount: z.number().int().min(12).max(36).default(18),
});

export function slugifyCardName(name: string, index: number): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const translit = name
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 38);
  return `${translit || "part"}-${index + 1}`;
}

export function createGeneratedMarketSchema(template: GameTemplate, count: number) {
  const stats = Object.fromEntries(template.stats.map(({ id }) => [id, z.number().int().min(-4).max(6)]));
  const slotIds = template.slots.map(({ id }) => id) as [string, ...string[]];
  const card = z.object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(2).max(80),
    slotId: z.enum(slotIds),
    rarity: CardRaritySchema,
    tier: z.number().int().min(1).max(5),
    price: z.number().int().min(1).max(24),
    dayAvailable: z.number().int().min(1).max(template.totalDays),
    stats: z.object(stats),
    trackBonus: z.number().int().min(0).max(2),
    stock: z.number().int().min(1).max(10),
    effectScope: EffectScopeSchema.nullable().optional(),
    flavor: z.string().max(140).nullable().optional(),
  });
  return z.object({ cards: z.array(card).min(Math.min(6, count)).max(48) });
}

export const GeneratedLorePackSchema = z.object({
  dayBriefings: z.array(LoreBriefingSchema).min(1).max(15),
});

export type GeneratedMarketValidation =
  | { success: true; cards: CardItem[] }
  | { success: false; issues: string[] };

export function validateGeneratedMarket(
  value: unknown,
  template: GameTemplate,
  expectedCount?: number,
): GeneratedMarketValidation {
  const parsed = createGeneratedMarketSchema(template, expectedCount ?? 6).safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues
        .slice(0, 15)
        .map((issue) => `${issue.path.join(".") || "cards"}: ${issue.message}`),
    };
  }

  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const issues: string[] = [];

  const normalized: CardItem[] = parsed.data.cards.map((raw, idx) => {
    const cleanId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.id) ? raw.id : slugifyCardName(raw.name, idx);
    const finalId = usedIds.has(cleanId) ? `${cleanId}-${idx + 1}` : cleanId;
    usedIds.add(finalId);

    const nameKey = raw.name.normalize("NFKC").toLowerCase();
    if (usedNames.has(nameKey)) {
      issues.push(`Дублирующееся название детали «${raw.name}»`);
    }
    usedNames.add(nameKey);

    return {
      id: finalId,
      name: raw.name.trim(),
      slotId: raw.slotId,
      rarity: raw.rarity,
      tier: raw.tier,
      price: raw.price,
      dayAvailable: raw.dayAvailable,
      stats: raw.stats,
      trackBonus: raw.trackBonus,
      stock: raw.stock,
      ...(raw.effectScope ? { effectScope: raw.effectScope } : {}),
      ...(raw.flavor ? { flavor: raw.flavor } : {}),
    };
  });

  return issues.length > 0 ? { success: false, issues } : { success: true, cards: normalized };
}

export function analyzeGeneratedMarket(cards: CardItem[], template: GameTemplate): BalanceReport {
  return validateGameBalance({ ...template, cards });
}

export type MarketGenerationInput = z.infer<typeof MarketGenerationInputSchema>;
export type LoreGenerationInput = z.infer<typeof LoreGenerationInputSchema>;
export type ShiftWizardInput = z.infer<typeof ShiftWizardInputSchema>;
