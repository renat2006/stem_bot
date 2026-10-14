import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { ClientMessage, ServerMessage } from "@stem/shared";
import { type WebSocket, WebSocketServer } from "ws";
import { activeEventId } from "../modules/event/repository.js";
import { config } from "../shared/config.js";
import { AuthError, identityFromDevUser, identityFromInitData } from "../shared/identity.js";
import { runtime } from "../shared/runtime.js";
import type { LiveClient } from "./hub.js";

export const WS_PATH = "/api/ws";
const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 25_000;
const MAX_MESSAGES_PER_WINDOW = 30;
const RATE_WINDOW_MS = 10_000;

function allowedOrigin(req: IncomingMessage) {
  if (!config.PUBLIC_URL) return true;
  return req.headers.origin === new URL(config.PUBLIC_URL).origin;
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as Partial<ClientMessage>;
    if (value.type === "ping") return { type: "ping" };
    if (value.type === "auth") {
      const message = value as { initData?: unknown; devUser?: unknown };
      return {
        type: "auth",
        initData: typeof message.initData === "string" ? message.initData : undefined,
        devUser: typeof message.devUser === "string" ? message.devUser : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024, perMessageDeflate: true });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== WS_PATH) return;
    if (!allowedOrigin(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws: WebSocket) => {
    const send = (message: ServerMessage) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    };
    const client: LiveClient = { rulesVersion: 0, send };
    let eventId: string | null = null;
    let windowStart = Date.now();
    let messages = 0;
    alive.set(ws, true);

    const authTimer = setTimeout(() => ws.close(4401, "auth timeout"), AUTH_TIMEOUT_MS);

    ws.on("pong", () => alive.set(ws, true));
    ws.on("close", () => {
      clearTimeout(authTimer);
      if (eventId) runtime().hub.leave(eventId, client);
    });

    ws.on("message", async (data) => {
      if (Date.now() - windowStart > RATE_WINDOW_MS) {
        windowStart = Date.now();
        messages = 0;
      }
      if (++messages > MAX_MESSAGES_PER_WINDOW) return ws.close(4429, "rate limit");

      const message = parseMessage(data.toString());
      if (!message) return send({ type: "error", message: "Некорректное сообщение" });
      if (message.type === "ping") return send({ type: "pong", serverTime: new Date().toISOString() });
      if (eventId) return;

      try {
        if (message.initData) client.identity = identityFromInitData(message.initData);
        else if (message.devUser) client.identity = identityFromDevUser(message.devUser) ?? undefined;
        if (config.isProduction && !client.identity) throw new AuthError("Требуется авторизация Telegram");
      } catch (error) {
        send({ type: "error", message: error instanceof AuthError ? error.message : "Ошибка авторизации" });
        return ws.close(4401, "unauthorized");
      }

      clearTimeout(authTimer);
      eventId = await activeEventId(runtime().db);
      if (!eventId) return ws.close(4404, "no active event");
      await runtime().hub.join(eventId, client);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);

  return {
    close: () => {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.close(1012, "restart");
      wss.close();
    },
  };
}
