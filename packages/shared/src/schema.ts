import { z } from "zod";

export const StatShapeSchema = z.enum(["tri", "up", "sq", "hex", "dia"]);

export const CardRaritySchema = z.enum(["common", "rare", "legendary"]);

export const EffectScopeSchema = z.enum(["step", "event_shield", "economy", "slot_synergy"]);

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
  rarity: CardRaritySchema.default("common"),
  tier: z.number().int().min(1).max(5).default(1),
  price: z.number().int().nonnegative(),
  dayAvailable: z.number().int().min(1),
  stats: z.record(z.string(), z.number().int()),
  trackBonus: z.number().int().default(0),
  stock: z.number().int().min(1).default(3),
  effectScope: EffectScopeSchema.optional(),
  flavor: z.string().optional(),
  sellerTeam: z.string().optional(),
  actionTag: z.string().optional(),
  actionBadge: z.string().optional(),
  circuitLoad: z.number().int().min(0).max(4).optional(),
});

export const RarityRuleSchema = z.object({
  maxPositiveSum: z.number().int().min(1).max(12),
  minNegativeSum: z.number().int().min(0).max(8),
  defaultStock: z.number().int().min(1).max(10),
  minPrice: z.number().int().min(1).max(30),
});

export const RarityConfigSchema = z.object({
  common: RarityRuleSchema.default({ maxPositiveSum: 2, minNegativeSum: 0, defaultStock: 4, minPrice: 2 }),
  rare: RarityRuleSchema.default({ maxPositiveSum: 4, minNegativeSum: 1, defaultStock: 2, minPrice: 4 }),
  legendary: RarityRuleSchema.default({ maxPositiveSum: 6, minNegativeSum: 2, defaultStock: 1, minPrice: 6 }),
});

export const FeatureFlagsSchema = z.object({
  p2pMarket: z.boolean().default(true),
  p2pMinPriceRatio: z.number().min(0.2).max(2).default(0.5),
  p2pMaxPriceRatio: z.number().min(1).max(5).default(2.5),
  p2pFeePercent: z.number().int().min(0).max(30).default(0),
  p2pCountsTowardLimit: z.boolean().default(false),
  slotInventory: z.boolean().default(true),
  auctions: z.boolean().default(true),
  perks: z.boolean().default(true),
  dayEvents: z.boolean().default(true),
  allowBuyoff: z.boolean().default(true),
  teamProposals: z.boolean().default(true),
  undoPurchase: z.boolean().default(true),
  storyBriefings: z.boolean().default(true),
  catchUpBonus: z.boolean().default(true),
  powerCircuit: z.boolean().default(true),
  actionTags: z.boolean().default(true),
  openMilestones: z.boolean().default(true),
  offClassPlayground: z.boolean().default(true),
});

export const RoundEngineTypeSchema = z.enum(["mission", "diagnosis", "legacy_track"]);

export const TemplateLexiconSchema = z.object({
  objectName: z.string().min(1),
  currencyLabel: z.string().min(1),
  currencyUnit: z.string().min(1),
  reserveLabel: z.string().min(1),
  environmentLabel: z.string().min(1),
  programLabel: z.string().min(1),
  diagnosisLabel: z.string().min(1),
  circuitLabel: z.string().min(1),
  extraRiskLabel: z.string().min(1),
  sectorALabel: z.string().min(1),
  sectorBLabel: z.string().min(1),
  workshopNoun: z.string().min(1),
});

export const DayScheduleItemSchema = z.object({
  day: z.number().int().min(1),
  engine: RoundEngineTypeSchema,
});

export const MissionRouteOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  statId: z.string().min(1),
  min: z.number().int(),
  bonusPoints: z.number().int().default(0),
  requiredTag: z.string().optional(),
  tagCardName: z.string().optional(),
  loadCost: z.number().int().nonnegative().default(1),
});

export const MissionConditionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  delta: z.number().int(),
  weight: z.number().positive().default(1),
});

export const MissionDayConfigSchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  routesA: z.array(MissionRouteOptionSchema).min(1),
  deliveryB: z.object({
    label: z.string().min(1),
    statId: z.string().min(1),
    min: z.number().int(),
  }),
  conditions: z.array(MissionConditionOptionSchema).min(1),
  transferPrompt: z.string().min(1),
});

export const DiagnosisHypothesisSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  explanation: z.string().min(1),
});

export const DiagnosisProbeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  resultByHypothesis: z.record(z.string(), z.string()),
});

export const DiagnosisDayConfigSchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  symptom: z.string().min(1),
  hypotheses: z.array(DiagnosisHypothesisSchema).min(2),
  probes: z.array(DiagnosisProbeSchema).min(1),
  secretHypothesisId: z.string().min(1),
  maxProbes: z.number().int().min(1).max(4).default(2),
  transferPrompt: z.string().min(1),
});

export const MissionTeamOrdersSchema = z.object({
  routeId: z.string().default("short"),
  paceA: z.enum(["normal", "fast", "pause"]).default("normal"),
  paceB: z.enum(["normal", "fast", "pause"]).default("normal"),
  extraCargo: z.boolean().default(false),
  reserveTarget: z.enum(["A", "B"]).default("A"),
});

export const TeamRoundStateSchema = z.object({
  orders: MissionTeamOrdersSchema.default({
    routeId: "short",
    paceA: "normal",
    paceB: "normal",
    extraCargo: false,
    reserveTarget: "A",
  }),
  readySlots: z.array(z.number().int().min(0).max(4)).default([]),
  pingedSlots: z.array(z.number().int().min(0).max(4)).default([]),
  usedProbes: z.array(z.string()).default([]),
  probeObservations: z.record(z.string(), z.string()).default({}),
  eliminatedHypotheses: z.record(z.string(), z.string()).default({}),
  selectedHypothesisId: z.string().nullable().default(null),
  diagnosisSubmitted: z.boolean().default(false),
  lastRoundPoints: z.number().int().default(0),
  seasonPoints: z.number().int().default(0),
  transferNote: z.string().default(""),
});

export const RoundLiveModeSchema = z.enum(["idle", "blind_draft", "negotiation", "diagnosis", "revealed"]);

export const LoreBriefingSchema = z.object({
  day: z.number().int().min(0),
  title: z.string().min(1),
  story: z.string().min(1),
  challengeTitle: z.string().optional(),
  focusStatId: z.string().optional(),
  targetMin: z.number().int().optional(),
  illustrationKey: z.string().optional(),
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
  rewardTrack: z.number().int().default(1),
  penaltyTrack: z.number().int().default(-1),
  buyoffCost: z.number().int().nonnegative().default(2),
});

export const BoardCellSchema = z.object({
  rewardBands: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])).optional(),
  position: z.number().int().min(1),
  type: z.enum(["start", "mutation", "resource", "challenge", "catastrophe", "apex"]),
  label: z.string().min(1),
  description: z.string().optional(),
  statId: z.string().optional(),
  minStat: z.number().int().optional(),
  losePartMaxStat: z.number().int().optional(),
  rewardCurrency: z.number().int().default(0),
  rewardTrack: z.number().int().default(0),
  penaltyCurrency: z.number().int().default(0),
  penaltyTrack: z.number().int().default(0),
  buyoffCost: z.number().int().nonnegative().optional(),
});

export const EventFactSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const DefaultFeatures = FeatureFlagsSchema.parse({});
export const DefaultRarityRules = RarityConfigSchema.parse({});

export const GameTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  eventTag: z.string().default("STEM-ШКОЛА"),
  eventKey: z.enum(["neurofauna", "startup", "airship", "rovers"]).default("neurofauna"),
  objectName: z.string().default("Существо"),
  artPackId: z.string().min(1).optional(),
  objectRig: z.enum(["creature", "airship", "campus", "rover"]).default("creature"),
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
  allStatsStepBonus: z
    .object({
      min: z.number().int(),
      bonus: z.number().int().min(1),
    })
    .optional(),
  elitePartStepBonus: z.number().int().min(0).default(0),
  physicalBoard: z.boolean().optional(),
  cards: z.array(CardItemSchema),
  perks: z.array(PerkPropertySchema),
  boardCells: z.array(BoardCellSchema),
  extraModule: ExtraModuleSchema.optional(),
  features: FeatureFlagsSchema.default(DefaultFeatures),
  rarityRules: RarityConfigSchema.default(DefaultRarityRules),
  dayBriefings: z.array(LoreBriefingSchema).default([]),
  lexicon: TemplateLexiconSchema.optional(),
  daySchedule: z.array(DayScheduleItemSchema).default([]),
  missionDays: z.array(MissionDayConfigSchema).default([]),
  diagnosisDays: z.array(DiagnosisDayConfigSchema).default([]),
});

export const ShiftPhaseSchema = z.enum(["scoring", "market", "turn", "summary"]);

export const P2PListingSchema = z.object({
  id: z.string(),
  sellerTeamId: z.string(),
  sellerTeamName: z.string(),
  cardId: z.string(),
  price: z.number().int().positive(),
  createdAt: z.string(),
});

export const AuctionLotSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  startingPrice: z.number().int().positive(),
  currentBid: z.number().int().nonnegative(),
  leaderTeamId: z.string().nullable(),
  leaderTeamName: z.string().nullable(),
  bidCount: z.number().int().nonnegative().default(0),
  endsAt: z.string(),
  status: z.enum(["open", "settled", "cancelled"]),
});

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
  roundMode: RoundLiveModeSchema.optional(),
  roundEngine: RoundEngineTypeSchema.optional(),
  revealedConditionId: z.string().nullable().optional(),
  canUndoLastReward: z.boolean().optional(),
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  monogram: z.string().default("К1"),
  joinCode: z.string().default("HX01"),
  captainUsername: z.string(),
  members: z.array(z.string()).default(["Е", "О", "М", "Д"]),
  currency: z.number().int(),
  heldCurrency: z.number().int().nonnegative().default(0),
  trackPosition: z.number().int().min(1),
  boardPosition: z.number().int().min(1),
  purchasesToday: z.number().int().nonnegative(),
  equippedCards: z.record(z.string(), z.string().nullable()),
  inventory: z.array(z.string()).default([]),
  badges: z.array(z.string()).default([]),
  activePerkId: z.string().nullable(),
  statModifiers: z.record(z.string(), z.number().int()),
  roundState: TeamRoundStateSchema.optional(),
});

export type RoundEngineType = z.infer<typeof RoundEngineTypeSchema>;
export type TemplateLexicon = z.infer<typeof TemplateLexiconSchema>;
export type DayScheduleItem = z.infer<typeof DayScheduleItemSchema>;
export type MissionRouteOption = z.infer<typeof MissionRouteOptionSchema>;
export type MissionConditionOption = z.infer<typeof MissionConditionOptionSchema>;
export type MissionDayConfig = z.infer<typeof MissionDayConfigSchema>;
export type DiagnosisHypothesis = z.infer<typeof DiagnosisHypothesisSchema>;
export type DiagnosisProbe = z.infer<typeof DiagnosisProbeSchema>;
export type DiagnosisDayConfig = z.infer<typeof DiagnosisDayConfigSchema>;
export type MissionTeamOrders = z.infer<typeof MissionTeamOrdersSchema>;
export type TeamRoundState = z.infer<typeof TeamRoundStateSchema>;
export type RoundLiveMode = z.infer<typeof RoundLiveModeSchema>;

export type StatShape = z.infer<typeof StatShapeSchema>;
export type CardRarity = z.infer<typeof CardRaritySchema>;
export type EffectScope = z.infer<typeof EffectScopeSchema>;
export type StatDefinition = z.infer<typeof StatDefinitionSchema>;
export type SlotDefinition = z.infer<typeof SlotDefinitionSchema>;
export type CardItem = z.infer<typeof CardItemSchema>;
export type RarityRule = z.infer<typeof RarityRuleSchema>;
export type RarityConfig = z.infer<typeof RarityConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type LoreBriefing = z.infer<typeof LoreBriefingSchema>;
export type PerkProperty = z.infer<typeof PerkPropertySchema>;
export type StepThreshold = z.infer<typeof StepThresholdSchema>;
export type ExtraModule = z.infer<typeof ExtraModuleSchema>;
export type BoardCell = z.infer<typeof BoardCellSchema>;
export type EventFact = z.infer<typeof EventFactSchema>;
export type ShiftPhase = z.infer<typeof ShiftPhaseSchema>;
export type P2PListing = z.infer<typeof P2PListingSchema>;
export type AuctionLot = z.infer<typeof AuctionLotSchema>;
export type GameTemplate = z.infer<typeof GameTemplateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Team = z.infer<typeof TeamSchema>;
