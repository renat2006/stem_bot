export type {
  FeedEntry,
  GameSnapshot,
  LiveState,
  ProposalInfo,
  RulesPayload,
  TeamMemberInfo,
  TeamWithStats,
  TemplateSummary,
  ViewerInfo,
} from "@stem/shared";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "polling";
