import type { Db } from "../db/client.js";
import type { RealtimeHub } from "../realtime/hub.js";

interface Runtime {
  db: Db;
  hub: RealtimeHub;
}

let current: Runtime | null = null;

export function setRuntime(next: Runtime) {
  current = next;
}

export function runtime(): Runtime {
  if (!current) throw new Error("Runtime is not initialized");
  return current;
}
