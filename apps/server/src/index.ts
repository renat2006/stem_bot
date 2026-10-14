import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { configureBotDelivery, createTelegramBot } from "./bot/index.js";
import { adminRouter } from "./modules/admin/routes.js";
import { gameRouter } from "./modules/game/routes.js";
import { teamRouter } from "./modules/team/routes.js";
import type { AppEnv } from "./shared/app-env.js";
import { config } from "./shared/config.js";
import { DomainError } from "./shared/errors.js";
import { tmaAuthMiddleware } from "./shared/telegram-auth.js";

const WEBHOOK_PATH = "/telegram/webhook";

const app = new Hono<AppEnv>();
const bot = config.BOT_TOKEN ? createTelegramBot(config.BOT_TOKEN, config.webAppUrl) : null;
const webhook =
  config.PUBLIC_URL && config.WEBHOOK_SECRET
    ? { url: new URL(WEBHOOK_PATH, config.PUBLIC_URL).href, secret: config.WEBHOOK_SECRET }
    : null;

app.use("/api/*", cors(config.PUBLIC_URL ? { origin: new URL(config.PUBLIC_URL).origin } : undefined));
app.get("/api/health", (c) => c.json({ status: "ok", version: config.APP_VERSION }));

app.use("/api/*", tmaAuthMiddleware);
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

if (bot) {
  configureBotDelivery(bot, webhook).catch((error) => {
    console.error("Bot delivery setup failed", error);
    process.exitCode = 1;
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    if (bot?.isRunning()) await bot.stop();
    server.close();
  });
}

export type AppType = typeof app;
