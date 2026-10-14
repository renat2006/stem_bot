import { z } from "zod";

export const StatDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
});

export const SlotDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const CardItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slotId: z.string().min(1),
  price: z.number().int().nonnegative(),
  dayAvailable: z.number().int().min(1),
  stats: z.record(z.string(), z.number().int()),
  trackBonus: z.number().int().default(0),
});

export const PerkPropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  dayAvailable: z.number().int().min(1),
  stats: z.record(z.string(), z.number().int()),
  effectText: z.string().min(1),
  minStatsCondition: z.record(z.string(), z.number().int()).optional(),
});

export const BoardCellSchema = z.object({
  position: z.number().int().min(1),
  type: z.enum(["start", "mutation", "resource", "challenge", "catastrophe", "apex"]),
  label: z.string().min(1),
  buyoffCost: z.number().int().nonnegative().optional(),
});

export const GameTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  currencyName: z.string().min(1),
  currencyIcon: z.string().min(1),
  totalDays: z.number().int().min(1),
  trackName: z.string().min(1),
  trackMax: z.number().int().min(5),
  dailyPurchaseLimit: z.number().int().nullable(),
  rewardReasons: z.array(z.string().min(1)),
  stats: z.array(StatDefinitionSchema).min(1),
  slots: z.array(SlotDefinitionSchema).min(1),
  cards: z.array(CardItemSchema),
  perks: z.array(PerkPropertySchema),
  boardCells: z.array(BoardCellSchema),
});

export const GameStateSchema = z.object({
  activeTemplateId: z.string(),
  currentDay: z.number().int().min(1),
  purchasePhaseActive: z.boolean(),
  dailyPurchaseLimit: z.number().int().nullable(),
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  captainUsername: z.string(),
  currency: z.number().int(),
  trackPosition: z.number().int().min(1),
  boardPosition: z.number().int().min(1),
  purchasesToday: z.number().int().nonnegative(),
  equippedCards: z.record(z.string(), z.string().nullable()),
  activePerkId: z.string().nullable(),
  statModifiers: z.record(z.string(), z.number().int()),
});

export type StatDefinition = z.infer<typeof StatDefinitionSchema>;
export type SlotDefinition = z.infer<typeof SlotDefinitionSchema>;
export type CardItem = z.infer<typeof CardItemSchema>;
export type PerkProperty = z.infer<typeof PerkPropertySchema>;
export type BoardCell = z.infer<typeof BoardCellSchema>;
export type GameTemplate = z.infer<typeof GameTemplateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Team = z.infer<typeof TeamSchema>;
