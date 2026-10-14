import type { BalanceReport, GameState, GameTemplate, Team, TeamComputedStats } from "@stem/shared";

export interface TeamWithStats extends Team {
  computedStats: TeamComputedStats;
}

export type TemplateSummary = Pick<GameTemplate, "id" | "title" | "theme" | "currencyName" | "currencyIcon">;

export interface GameSnapshot {
  gameState: GameState;
  template: GameTemplate;
  availableTemplates: TemplateSummary[];
  balanceReport: BalanceReport;
  teams: TeamWithStats[];
}
