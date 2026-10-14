import type {
  BalanceReport,
  GameState,
  GameTemplate,
  Team,
  TeamComputedStats,
} from "@stem/shared";
import { getRawInitData } from "../lib/telegram.js";

export interface TeamWithStats extends Team {
  computedStats: TeamComputedStats;
}

export interface GameSnapshotResponse {
  gameState: GameState;
  template: GameTemplate;
  availableTemplates: Array<{
    id: string;
    title: string;
    theme: string;
    currencyName: string;
    currencyIcon: string;
  }>;
  balanceReport: BalanceReport;
  teams: TeamWithStats[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const rawInitData = getRawInitData();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (rawInitData) {
    headers["Authorization"] = `tma ${rawInitData}`;
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Ошибка запроса к серверу");
  }
  return data as T;
}

export const api = {
  getState: () => request<GameSnapshotResponse>("/api/game/state"),
  buyCard: (teamId: string, cardId: string) =>
    request<{ team: TeamWithStats }>("/api/team/buy-card", {
      method: "POST",
      body: JSON.stringify({ teamId, cardId }),
    }),
  buyPerk: (teamId: string, perkId: string) =>
    request<{ team: TeamWithStats }>("/api/team/buy-perk", {
      method: "POST",
      body: JSON.stringify({ teamId, perkId }),
    }),
  rewardTeam: (teamId: string, amount: number) =>
    request<{ team: Team }>("/api/admin/reward", {
      method: "POST",
      body: JSON.stringify({ teamId, amount }),
    }),
  moveTrack: (teamId: string, delta: number) =>
    request<{ team: Team }>("/api/admin/move-track", {
      method: "POST",
      body: JSON.stringify({ teamId, delta }),
    }),
  updateGameState: (payload: Partial<GameState>) =>
    request<{ gameState: GameState }>("/api/admin/game-state", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  switchTemplate: (templateId: string) =>
    request<{ template: GameTemplate; gameState: GameState }>("/api/admin/switch-template", {
      method: "POST",
      body: JSON.stringify({ templateId }),
    }),
};
