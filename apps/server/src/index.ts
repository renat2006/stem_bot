import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createTelegramBot } from "./bot/index.js";
import { adminRouter } from "./modules/admin/routes.js";
import { gameRouter } from "./modules/game/routes.js";
import { teamRouter } from "./modules/team/routes.js";
import type { AppEnv } from "./shared/app-env.js";
import { DomainError } from "./shared/errors.js";
import { tmaAuthMiddleware } from "./shared/telegram-auth.js";

const app = new Hono<AppEnv>();

app.use("/api/*", cors());
app.get("/api/health", (c) => c.json({ status: "ok" }));

app.use("/api/*", tmaAuthMiddleware);
app.route("/api/game", gameRouter);
app.route("/api/team", teamRouter);
app.route("/api/admin", adminRouter);

app.onError((err, c) => {
  if (err instanceof DomainError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Внутренняя ошибка сервера" }, 500);
});

const port = Number(process.env.PORT ?? 3001);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`STEM Server running on http://localhost:${info.port}`);
});

const botToken = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL ?? "http://localhost:5173";
const bot =
  botToken && botToken !== "your_telegram_bot_token_here" ? createTelegramBot(botToken, webAppUrl) : null;

void bot?.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await bot?.stop();
    server.close();
  });
}

export type AppType = typeof app;
