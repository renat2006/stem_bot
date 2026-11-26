import type { Db } from "../db/client.js";
import type { RealtimeHub } from "../realtime/hub.js";

export interface QueuedAlert {
  target: "team" | "all-teams" | "admins";
  teamId?: string;
  text: string;
  parseMode?: "HTML";
  silent?: boolean;
  ctaLabel?: string;
  ctaPath?: string;
}

export interface DispatchReport {
  attempted: number;
  delivered: number;
  blocked: number;
  teams: number;
}

export interface AlertService {
  dispatch: (eventId: string, alerts: QueuedAlert[]) => Promise<DispatchReport>;
}

interface Runtime {
  db: Db;
  hub: RealtimeHub;
  alerts?: AlertService;
}

let current: Runtime | null = null;

export function setRuntime(next: Runtime) {
  current = next;
}

export function runtime(): Runtime {
  if (!current) throw new Error("Runtime is not initialized");
  return current;
}
