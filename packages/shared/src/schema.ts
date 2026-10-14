import { z } from "zod";

export const StatShapeSchema = z.enum(["tri", "up", "sq", "hex", "dia"]);

export const StatDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  shape: StatShapeSchema.default("sq"),
  color: z.string().default("oklch(0.6 0.15 240)"),
});

export const SlotDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const CardItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slotId: z.string().min(1),
  tier: z.number().int().min(1).max(5).default(1),
  price: z.number().int().nonnegative(),
  dayAvailable: z.number().int().min(1),
  stats: z.record(z.string(), z.number().int()),
  trackBonus: z.number().int().default(0),
  stock: z.number().int().min(1).default(3),
  sellerTeam: z.string().optional(),
});

export const PerkPropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().optional(),
  price: z.number().int().nonnegative(),
  dayAvailable: z.number().int().min(1),
  stats: z.record(z.string(), z.number().int()),
  effectText: z.string().min(1),
  minStatsCondition: z.record(z.string(), z.number().int()).optional(),
  stepBonus: z.number().int().default(0),
});

export const StepThresholdSchema = z.object({
  statId: z.string().min(1),
  min: z.number().int(),
  bonus: z.number().int().min(1),
});

export const ExtraModuleSchema = z.object({
  tag: z.string().min(1),
  moduleLabel: z.string().min(1),
  title: z.string().min(1),
  statId: z.string().min(1),
  min: z.number().int(),
  danger: z.boolean(),
  okLabel: z.string().min(1),
  badLabel: z.string().min(1),
  chips: z.array(z.string().min(1)),
});

export const BoardCellSchema = z.object({
  position: z.number().int().min(1),
  type: z.enum(["start", "mutation", "resource", "challenge", "catastrophe", "apex"]),
  label: z.string().min(1),
  buyoffCost: z.number().int().nonnegative().optional(),
});

export const EventFactSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const GameTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  eventTag: z.string().default("STEM-ШКОЛА"),
  eventKey: z.enum(["neurofauna", "startup", "airship"]).default("neurofauna"),
  objectName: z.string().default("Существо"),
  artPackId: z.string().min(1).optional(),
  objectRig: z.enum(["creature", "airship", "campus"]).default("creature"),
  currencyName: z.string().min(1),
  currencyIcon: z.string().min(1),
  totalDays: z.number().int().min(1),
  totalPoints: z.number().int().min(1).default(5),
  phaseMode: z.string().default("ПО КНОПКЕ"),
  nextPhaseLabel: z.string().default("ход по треку"),
  phaseDurationSeconds: z.number().int().min(60).default(1800),
  trackName: z.string().min(1),
  trackMax: z.number().int().min(5),
  dailyPurchaseLimit: z.number().int().nullable(),
  gridAreas: z.string().default('"front head back" "body core tail" ". special ."'),
  accentColors: z.tuple([z.string(), z.string()]).default(["oklch(0.5 0.13 150)", "oklch(0.76 0.14 150)"]),
  coinColors: z.tuple([z.string(), z.string()]).default(["oklch(0.5 0.13 150)", "oklch(0.76 0.14 150)"]),
  facts: z.array(EventFactSchema).default([]),
  rewardReasons: z.array(z.string().min(1)),
  stats: z.array(StatDefinitionSchema).min(1),
  slots: z.array(SlotDefinitionSchema).min(1),
  stepThresholds: z.array(StepThresholdSchema).default([]),
  cards: z.array(CardItemSchema),
  perks: z.array(PerkPropertySchema),
  boardCells: z.array(BoardCellSchema),
  extraModule: ExtraModuleSchema.optional(),
});

export const ShiftPhaseSchema = z.enum(["scoring", "market", "turn", "summary"]);

export const GameStateSchema = z.object({
  activeTemplateId: z.string(),
  currentDay: z.number().int().min(1),
  currentPoint: z.number().int().min(1).default(1),
  currentPhase: ShiftPhaseSchema.default("scoring"),
  purchasePhaseActive: z.boolean(),
  dailyPurchaseLimit: z.number().int().nullable(),
  secondsLeft: z.number().int().nonnegative().default(0),
  phaseEndsAt: z.string().nullable().default(null),
  rulesVersion: z.number().int().min(1).default(1),
  rulesUpdatedNote: z.string().default("Версия 1 · Старт смены"),
  cardStockLeft: z.record(z.string(), z.number().int().nonnegative()).default({}),
  cardSoldTo: z.record(z.string(), z.string()).default({}),
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  monogram: z.string().default("К1"),
  joinCode: z.string().default("HX01"),
  captainUsername: z.string(),
  members: z.array(z.string()).default(["Е", "О", "М", "Д"]),
  currency: z.number().int(),
  trackPosition: z.number().int().min(1),
  boardPosition: z.number().int().min(1),
  purchasesToday: z.number().int().nonnegative(),
  equippedCards: z.record(z.string(), z.string().nullable()),
  activePerkId: z.string().nullable(),
  statModifiers: z.record(z.string(), z.number().int()),
});

export type StatShape = z.infer<typeof StatShapeSchema>;
export type StatDefinition = z.infer<typeof StatDefinitionSchema>;
export type SlotDefinition = z.infer<typeof SlotDefinitionSchema>;
export type CardItem = z.infer<typeof CardItemSchema>;
export type PerkProperty = z.infer<typeof PerkPropertySchema>;
export type StepThreshold = z.infer<typeof StepThresholdSchema>;
export type ExtraModule = z.infer<typeof ExtraModuleSchema>;
export type BoardCell = z.infer<typeof BoardCellSchema>;
export type EventFact = z.infer<typeof EventFactSchema>;
export type ShiftPhase = z.infer<typeof ShiftPhaseSchema>;
export type GameTemplate = z.infer<typeof GameTemplateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Team = z.infer<typeof TeamSchema>;
