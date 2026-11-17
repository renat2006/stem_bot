export type {
  AuctionLot,
  FeedEntry,
  GameSnapshot,
  LiveAdvisorAlert,
  LiveBalanceDashboard,
  LiveState,
  LoreBriefing,
  P2PListing,
  ProposalInfo,
  QuickFixKind,
  RulesPayload,
  TeamMemberInfo,
  TeamWithStats,
  TemplateSummary,
  ViewerInfo,
} from "@stem/shared";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "polling";
