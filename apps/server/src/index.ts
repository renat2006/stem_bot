import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  configureBotDelivery,
  createAdminBot,
  createAlertService,
  createBotWebhookHandler,
  createPlayerBot,
} from "./bot/index.js";
import { connectPglite, connectPostgres } from "./db/client.js";
import { adminRouter } from "./modules/admin/routes.js";
import { activeEventId, settleExpiredAuctions } from "./modules/event/repository.js";
import { ensureActiveEvent } from "./modules/event/seed.js";
import { gameRouter } from "./modules/game/routes.js";
import { teamRouter } from "./modules/team/routes.js";
import { RealtimeHub } from "./realtime/hub.js";
import { attachRealtime } from "./realtime/ws-server.js";
import type { AppEnv } from "./shared/app-env.js";
import { config } from "./shared/config.js";
import { DomainError } from "./shared/errors.js";
import { snapshotResponse } from "./shared/route-context.js";
import { runtime, setRuntime } from "./shared/runtime.js";
import { identityMiddleware } from "./shared/telegram-auth.js";

const PLAYER_WEBHOOK_PATH = "/telegram/webhook";
const ADMIN_WEBHOOK_PATH = "/telegram/admin-webhook";

const database = config.DATABASE_URL
  ? await connectPostgres(config.DATABASE_URL, config.MIGRATIONS_DIR)
  : await connectPglite(config.PGLITE_DIR, config.MIGRATIONS_DIR);

const hub = new RealtimeHub(() => runtime().db);
const playerBot = config.BOT_TOKEN ? createPlayerBot(config.BOT_TOKEN, config.webAppUrl) : null;
const adminBot = config.ADMIN_BOT_TOKEN
  ? createAdminBot(config.ADMIN_BOT_TOKEN, config.adminWebAppUrl, config.adminIds)
  : null;

const alerts = createAlertService({
  playerBot,
  adminBot,
  adminIds: config.adminIds,
  webAppUrl: config.webAppUrl,
  adminWebAppUrl: config.adminWebAppUrl,
});

setRuntime({ db: database.db, hub, alerts });
await ensureActiveEvent(database.db, config.seedDemoTeams);

const app = new Hono<AppEnv>();

const playerWebhook =
  config.webhookBaseUrl && config.WEBHOOK_SECRET
    ? { url: new URL(PLAYER_WEBHOOK_PATH, config.webhookBaseUrl).href, secret: config.WEBHOOK_SECRET }
    : null;
const adminWebhook =
  config.webhookBaseUrl && config.WEBHOOK_SECRET
    ? { url: new URL(ADMIN_WEBHOOK_PATH, config.webhookBaseUrl).href, secret: config.WEBHOOK_SECRET }
    : null;

app.use("/api/*", cors(config.PUBLIC_URL ? { origin: new URL(config.PUBLIC_URL).origin } : undefined));
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    version: config.APP_VERSION,
    clients: hub.size,
    bots: { player: Boolean(playerBot), admin: Boolean(adminBot) },
  }),
);

app.get("/api/game/public", (c) => snapshotResponse(c));
app.use("/api/*", identityMiddleware);
app.route("/api/game", gameRouter);
app.route("/api/team", teamRouter);
app.route("/api/admin", adminRouter);

if (playerBot && playerWebhook) {
  app.post(PLAYER_WEBHOOK_PATH, createBotWebhookHandler(playerBot, playerWebhook.secret));
}
if (adminBot && adminWebhook) {
  app.post(ADMIN_WEBHOOK_PATH, createBotWebhookHandler(adminBot, adminWebhook.secret));
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

const auctionSweepTimer = setInterval(async () => {
  try {
    const eventId = await activeEventId(database.db);
    if (eventId && (await settleExpiredAuctions(database.db, eventId))) {
      hub.publish(eventId, { rules: false });
    }
  } catch (err) {
    console.error("Auction sweep failed", err);
  }
}, 5_000);

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.warn(`STEM Server ${config.APP_VERSION} listening on :${info.port}`);
});
const realtime = attachRealtime(server as Server);

const allowPolling = config.BOT_POLLING && !config.isProduction;
if (playerBot) {
  configureBotDelivery(playerBot, {
    webhook: playerWebhook,
    polling: allowPolling,
    menuButton: { text: "Полевой атлас", url: config.webAppUrl },
    commands: [
      { command: "start", description: "Кабинет команды и статус" },
      { command: "status", description: "Баланс, поле и текущая фаза" },
      { command: "story", description: "Задача и легенда дня" },
      { command: "faq", description: "Короткая памятка по правилам" },
      { command: "playground", description: "Тренировка 3 мин (вне зачёта)" },
    ],
  }).catch((error) => {
    console.error("Player bot delivery setup failed", error);
    process.exitCode = 1;
  });
}
if (adminBot) {
  configureBotDelivery(adminBot, {
    webhook: adminWebhook,
    polling: allowPolling,
    menuButton: { text: "Студия смены", url: config.adminWebAppUrl },
    commands: [
      { command: "start", description: "Пульт живого урока и меню" },
      { command: "msg", description: "Написать командам в клиентский бот" },
      { command: "pulse", description: "Пульс зала и участники в боте" },
      { command: "wizard", description: "Конструктор смены за 4 шага" },
      { command: "balance", description: "Советник баланса и Парето" },
    ],
  }).catch((error) => {
    console.error("Admin bot delivery setup failed", error);
    process.exitCode = 1;
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    clearInterval(auctionSweepTimer);
    realtime.close();
    hub.close();
    if (playerBot?.isRunning()) await playerBot.stop();
    if (adminBot?.isRunning()) await adminBot.stop();
    server.close();
    await database.close();
  });
}

export type AppType = typeof app;
