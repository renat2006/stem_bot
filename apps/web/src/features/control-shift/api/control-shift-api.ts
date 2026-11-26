import type {
  CardItem,
  CardRarity,
  DayScheduleItem,
  EffectScope,
  FeatureFlags,
  GameSnapshot,
  LiveState,
  LoreBriefing,
  MarketGenerationInput,
  QuickFixKind,
  ShiftPhase,
  ShiftWizardInput,
  TemplateLexicon,
} from "@stem/shared";
import { patchJson, postJson, putJson, request } from "../../../shared/api/index.js";

export interface MarketDraftRecord {
  id: string;
  provider?: string;
  cards: CardItem[];
}

export interface UpsertCardPayload {
  id?: string;
  name: string;
  slotId: string;
  rarity: CardRarity;
  tier: number;
  price: number;
  dayAvailable: number;
  stats: Record<string, number>;
  trackBonus: number;
  stock: number;
  stockLeft?: number;
  effectScope?: EffectScope;
  flavor?: string;
}

export const setPhase = (phase: ShiftPhase, minutes: number | null = null) =>
  postJson<LiveState>("/api/admin/phase", { phase, minutes });

export const nextDay = (expectedDay: number) => postJson<LiveState>("/api/admin/next-day", { expectedDay });

export const applyTurn = (
  expectedDay: number,
  buyoffTeamIds?: string[],
  boardPositions?: Record<string, number>,
) => postJson<LiveState>("/api/admin/apply-turn", { expectedDay, buyoffTeamIds, boardPositions });

export const updatePurchaseLimit = (purchaseLimit: number | null) =>
  postJson<LiveState>("/api/admin/settings", { purchaseLimit });

export const resetEvent = (templateId: string | undefined, demoTeams: boolean) =>
  postJson<GameSnapshot>("/api/admin/reset", { templateId, demoTeams });

export const updateFeatures = (flags: Partial<FeatureFlags>) =>
  patchJson<GameSnapshot>("/api/admin/features", flags);

export const upsertCard = (input: UpsertCardPayload) => postJson<GameSnapshot>("/api/admin/cards", input);

export const applyQuickFix = (action: QuickFixKind) => postJson<GameSnapshot>("/api/admin/quick-fix", action);

export const saveDayBriefing = (briefing: LoreBriefing, broadcast: boolean) =>
  postJson<GameSnapshot>("/api/admin/briefings", { briefing, broadcast });

export const startAuction = (input: { cardId: string; startingPrice: number; durationMinutes: number }) =>
  postJson<LiveState>("/api/admin/auctions", input);

export const closeAuctionNow = (auctionId: string) =>
  postJson<LiveState>(`/api/admin/auctions/${encodeURIComponent(auctionId)}/close`);

export const fetchMarketDraft = () => request<{ draft: MarketDraftRecord | null }>("/api/admin/market/draft");

export const generateMarketDraft = async (input: MarketGenerationInput): Promise<MarketDraftRecord> => {
  const res = await postJson<{
    draftId: string;
    cards: CardItem[];
    provider: string;
  }>("/api/admin/market/generate", input);
  return { id: res.draftId, cards: res.cards, provider: res.provider };
};

export const updateMarketDraft = (draftId: string, cards: CardItem[]) =>
  putJson<{ draft: MarketDraftRecord }>(`/api/admin/market/draft/${encodeURIComponent(draftId)}`, {
    cards,
  });

export const decideMarketDraft = (
  draftId: string,
  decision: "approve" | "reject",
  mode: "append" | "replace" = "append",
) =>
  postJson<GameSnapshot>(`/api/admin/market/draft/${encodeURIComponent(draftId)}/decision`, {
    decision,
    mode,
  });

export const createShiftFromWizard = (input: ShiftWizardInput) =>
  postJson<GameSnapshot>("/api/admin/shift/create", input);

export const extendPhaseTimer = (seconds = 30) => postJson<LiveState>("/api/admin/timer/extend", { seconds });

export const startRoundEngine = (input?: {
  engine?: "mission" | "diagnosis";
  durationSeconds?: number;
  conditionId?: string;
}) => postJson<LiveState>("/api/admin/round/start", input ?? {});

export const revealMissionRound = (conditionId?: string) =>
  postJson<LiveState>("/api/admin/round/reveal", conditionId ? { conditionId } : {});

export const updateTemplateLexicon = (patch: Partial<TemplateLexicon>) =>
  patchJson<GameSnapshot>("/api/admin/lexicon", patch);

export const updateDaySchedule = (input: { totalDays?: number; daySchedule: DayScheduleItem[] }) =>
  patchJson<GameSnapshot>("/api/admin/schedule", input);

export const applyParetoFix = (day?: number) =>
  postJson<GameSnapshot>("/api/admin/pareto-fix", day ? { day } : {});

export interface BroadcastReport {
  attempted: number;
  delivered: number;
  blocked: number;
  teams: number;
}

export const broadcastToTeams = (input: { target: string; text: string; silent?: boolean }) =>
  postJson<{ report: BroadcastReport; targetLabel: string }>("/api/admin/broadcast", input);
