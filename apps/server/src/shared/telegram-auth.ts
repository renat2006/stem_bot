import { parse, validate } from "@tma.js/init-data-node";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./app-env.js";

const INIT_DATA_TTL_SECONDS = 3600;
const PLACEHOLDER_TOKEN = "your_telegram_bot_token_here";

function parseValidInitData(rawInitData: string, botToken: string) {
  validate(rawInitData, botToken, { expiresIn: INIT_DATA_TTL_SECONDS });
  return parse(rawInitData);
}

export const tmaAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const botToken = process.env.BOT_TOKEN ?? "";
  const isProd = process.env.NODE_ENV === "production";
  const [authType, authData = ""] = (c.req.header("authorization") ?? "").split(" ");

  if (authType === "tma" && authData && botToken && botToken !== PLACEHOLDER_TOKEN) {
    try {
      c.set("tmaInitData", parseValidInitData(authData, botToken));
    } catch {
      return c.json({ error: "Невалидная или просроченная подпись Telegram initData" }, 401);
    }
    return next();
  }

  if (isProd) {
    return c.json({ error: "Требуется авторизация Telegram Mini App (Authorization: tma ...)" }, 401);
  }

  return next();
});
