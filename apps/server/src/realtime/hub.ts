import type { ServerMessage } from "@stem/shared";
import type { Db } from "../db/client.js";
import { buildRules, loadGraph, shapeLiveState } from "../modules/event/snapshot.js";
import type { Identity } from "../shared/identity.js";

export interface LiveClient {
  identity?: Identity;
  rulesVersion: number;
  send: (message: ServerMessage) => void;
}

const FLUSH_DELAY_MS = 30;

export class RealtimeHub {
  private readonly rooms = new Map<string, Set<LiveClient>>();
  private readonly pending = new Map<string, { rules: boolean }>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly db: () => Db) {}

  get size() {
    let total = 0;
    for (const room of this.rooms.values()) total += room.size;
    return total;
  }

  async join(eventId: string, client: LiveClient) {
    const room = this.rooms.get(eventId) ?? new Set<LiveClient>();
    this.rooms.set(eventId, room);
    room.add(client);
    const graph = await loadGraph(this.db(), eventId);
    client.rulesVersion = graph.event.rulesVersion;
    client.send({ type: "snapshot", ...shapeLiveState(graph, client.identity), ...buildRules(graph.event) });
  }

  leave(eventId: string, client: LiveClient) {
    const room = this.rooms.get(eventId);
    room?.delete(client);
    if (room && room.size === 0) this.rooms.delete(eventId);
  }

  publish(eventId: string, change: { rules: boolean }) {
    const current = this.pending.get(eventId);
    this.pending.set(eventId, { rules: (current?.rules ?? false) || change.rules });
    if (this.timers.has(eventId)) return;
    this.timers.set(
      eventId,
      setTimeout(() => {
        this.timers.delete(eventId);
        void this.flush(eventId).catch((error) => console.error("Realtime flush failed", error));
      }, FLUSH_DELAY_MS),
    );
  }

  private async flush(eventId: string) {
    const change = this.pending.get(eventId);
    this.pending.delete(eventId);
    const room = this.rooms.get(eventId);
    if (!change || !room || room.size === 0) return;

    const graph = await loadGraph(this.db(), eventId);
    const rules = buildRules(graph.event);
    for (const client of room) {
      if (change.rules || client.rulesVersion !== graph.event.rulesVersion) {
        client.rulesVersion = graph.event.rulesVersion;
        client.send({ type: "rules", ...rules });
      }
      client.send({ type: "state", ...shapeLiveState(graph, client.identity) });
    }
  }

  close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
