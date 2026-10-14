import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { gameRouter } from "./modules/game/routes.js";
import { teamRouter } from "./modules/team/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { createTelegramBot } from "./bot/index.js";

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/game", gameRouter);
app.route("/api/team", teamRouter);
app.route("/api/admin", adminRouter);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`STEM Server running on http://localhost:${info.port}`);
});

const botToken = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL ?? "http://localhost:5173";

if (botToken && botToken !== "your_telegram_bot_token_here") {
  const bot = createTelegramBot(botToken, webAppUrl);
  bot.start();
}
