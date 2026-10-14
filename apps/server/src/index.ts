import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { configureBotDelivery, createTelegramBot } from "./bot/index.js";
import { connectPglite, connectPostgres } from "./db/client.js";
import { adminRouter } from "./modules/admin/routes.js";
import { ensureActiveEvent } from "./modules/event/seed.js";
import { gameRouter } from "./modules/game/routes.js";
import { teamRouter } from "./modules/team/routes.js";
import { RealtimeHub } from "./realtime/hub.js";
import { attachRealtime } from "./realtime/ws-server.js";
import type { AppEnv } from "./shared/app-env.js";
import { config } from "./shared/config.js";
import { DomainError } from "./shared/errors.js";
import { runtime, setRuntime } from "./shared/runtime.js";
import { identityMiddleware } from "./shared/telegram-auth.js";

const WEBHOOK_PATH = "/telegram/webhook";

const database = config.DATABASE_URL
  ? await connectPostgres(config.DATABASE_URL, config.MIGRATIONS_DIR)
  : await connectPglite(config.PGLITE_DIR, config.MIGRATIONS_DIR);
const hub = new RealtimeHub(() => runtime().db);
setRuntime({ db: database.db, hub });
await ensureActiveEvent(database.db, config.seedDemoTeams);

const app = new Hono<AppEnv>();
const bot = config.BOT_TOKEN ? createTelegramBot(config.BOT_TOKEN, config.webAppUrl) : null;
const webhook =
  config.PUBLIC_URL && config.WEBHOOK_SECRET
    ? { url: new URL(WEBHOOK_PATH, config.PUBLIC_URL).href, secret: config.WEBHOOK_SECRET }
    : null;

app.use("/api/*", cors(config.PUBLIC_URL ? { origin: new URL(config.PUBLIC_URL).origin } : undefined));
app.get("/api/health", (c) => c.json({ status: "ok", version: config.APP_VERSION, clients: hub.size }));

app.use("/api/*", identityMiddleware);
app.route("/api/game", gameRouter);
app.route("/api/team", teamRouter);
app.route("/api/admin", adminRouter);

if (bot && webhook) {
  app.post(WEBHOOK_PATH, webhookCallback(bot, "hono", { secretToken: webhook.secret }));
}

if (config.WEB_DIST_DIR) {
  app.use("/*", serveStatic({ root: config.WEB_DIST_DIR }));
  app.get("*", serveStatic({ path: `${config.WEB_DIST_DIR}/index.html` }));
}

app.onError((err, c) => {
  if (err instanceof DomainError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Внутренняя ошибка сервера" }, 500);
});

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.warn(`STEM Server ${config.APP_VERSION} listening on :${info.port}`);
  if (config.isProduction && !bot)
    console.warn("BOT_TOKEN is not set: Telegram auth is unavailable, API answers 401");
});
const realtime = attachRealtime(server as Server);

if (bot) {
  configureBotDelivery(bot, { webhook, polling: config.BOT_POLLING && !config.isProduction }).catch(
    (error) => {
      console.error("Bot delivery setup failed", error);
      process.exitCode = 1;
    },
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    realtime.close();
    hub.close();
    if (bot?.isRunning()) await bot.stop();
    server.close();
    await database.close();
  });
}

export type AppType = typeof app;
