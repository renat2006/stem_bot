import type { LiveBalanceDashboard } from "./advisor.js";
import type { BalanceReport, TeamComputedStats } from "./engine.js";
import type { AuctionLot, GameState, GameTemplate, P2PListing, Team } from "./schema.js";

export type MemberRole = "captain" | "member";

export interface ViewerInfo {
  userId: number | null;
  displayName: string;
  isAdmin: boolean;
  botSurface: "player" | "admin";
  teamId: string | null;
  role: MemberRole | null;
  needsJoin: boolean;
  isProduction: boolean;
}

export interface TeamWithStats extends Team {
  computedStats: TeamComputedStats;
}

export interface TeamMemberInfo {
  userId: number;
  displayName: string;
  username: string | null;
  role: MemberRole;
}

export interface ProposalInfo {
  id: string;
  teamId: string;
  cardId: string;
  listingId?: string | null;
  fromName: string;
  createdAt: string;
}

export interface FeedEntry {
  id: number;
  version: number;
  teamId: string | null;
  kind: string;
  amount: number | null;
  text: string;
  createdAt: string;
}

export interface TemplateSummary {
  id: string;
  title: string;
  theme: string;
  eventTag: string;
  objectName: string;
  totalDays: number;
  currencyName: string;
  currencyIcon: string;
}

export interface LiveState {
  eventId: string;
  version: number;
  serverTime: string;
  gameState: GameState;
  teams: TeamWithStats[];
  listings: P2PListing[];
  auctions: AuctionLot[];
  liveBalance: LiveBalanceDashboard;
  viewer: ViewerInfo;
  proposals: ProposalInfo[];
  feed: FeedEntry[];
  members: Record<string, TeamMemberInfo[]>;
}

export interface RulesPayload {
  rulesVersion: number;
  template: GameTemplate;
  availableTemplates: TemplateSummary[];
  balanceReport: BalanceReport;
}

export type GameSnapshot = LiveState & RulesPayload;

export type ClientMessage = { type: "auth"; initData?: string; devUser?: string } | { type: "ping" };

export type ServerMessage =
  | ({ type: "snapshot" } & GameSnapshot)
  | ({ type: "state" } & LiveState)
  | ({ type: "rules" } & RulesPayload)
  | { type: "pong"; serverTime: string }
  | { type: "error"; message: string };
