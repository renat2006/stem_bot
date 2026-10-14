import type { LiveState, RulesPayload, ServerMessage } from "@stem/shared";
import { getDevUser, getRawInitData } from "../../../shared/lib/index.js";
import type { ConnectionStatus } from "./types.js";

interface Handlers {
  onRules: (rules: RulesPayload) => void;
  onState: (state: LiveState) => void;
  onStatus: (status: ConnectionStatus) => void;
  onClockOffset: (offsetMs: number) => void;
  onError: (message: string) => void;
}

const PING_MS = 20_000;
const MAX_BACKOFF_MS = 15_000;
const POLL_MS = 5_000;
const FAILURES_BEFORE_POLLING = 3;

export class LiveConnection {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private stopped = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pingSentAt = 0;

  constructor(
    private readonly handlers: Handlers,
    private readonly poll: () => Promise<void>,
  ) {}

  start() {
    this.stopped = false;
    this.connect();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  stop() {
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearTimers();
    this.socket?.close(1000);
    this.socket = null;
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.socket?.readyState !== WebSocket.OPEN) {
      this.attempts = 0;
      this.reconnectNow();
    }
  };

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pingTimer = this.retryTimer = this.pollTimer = null;
  }

  private reconnectNow() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.socket?.close();
    this.connect();
  }

  private connect() {
    if (this.stopped) return;
    this.handlers.onStatus(this.attempts === 0 ? "connecting" : "reconnecting");
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      const initData = getRawInitData();
      socket.send(
        JSON.stringify({
          type: "auth",
          ...(initData ? { initData } : { devUser: getDevUser() ?? undefined }),
        }),
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === "snapshot") {
        this.attempts = 0;
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = null;
        this.handlers.onStatus("live");
        this.handlers.onRules(message);
        this.handlers.onState(message);
        this.startPing(socket);
      } else if (message.type === "rules") {
        this.handlers.onRules(message);
      } else if (message.type === "state") {
        this.handlers.onState(message);
      } else if (message.type === "pong") {
        const roundTrip = Date.now() - this.pingSentAt;
        this.handlers.onClockOffset(Date.parse(message.serverTime) + roundTrip / 2 - Date.now());
      } else if (message.type === "error") {
        this.handlers.onError(message.message);
      }
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.stopped) return;
      if (event.code === 4401) {
        this.handlers.onError("Не удалось подтвердить вход через Telegram. Откройте приложение заново.");
      }
      this.scheduleRetry();
    };
  }

  private startPing(socket: WebSocket) {
    const ping = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      this.pingSentAt = Date.now();
      socket.send(JSON.stringify({ type: "ping" }));
    };
    ping();
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(ping, PING_MS);
  }

  private scheduleRetry() {
    this.attempts += 1;
    if (this.attempts >= FAILURES_BEFORE_POLLING && !this.pollTimer) {
      this.handlers.onStatus("polling");
      this.pollTimer = setInterval(() => void this.poll().catch(() => {}), POLL_MS);
    } else if (!this.pollTimer) {
      this.handlers.onStatus("reconnecting");
    }
    const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (this.attempts - 1));
    const delay = base / 2 + Math.random() * (base / 2);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }
}
