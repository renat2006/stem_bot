import { parse, validate } from "@tma.js/init-data-node";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./app-env.js";
import { config } from "./config.js";

const INIT_DATA_TTL_SECONDS = 3600;

function parseValidInitData(rawInitData: string, botToken: string) {
  validate(rawInitData, botToken, { expiresIn: INIT_DATA_TTL_SECONDS });
  return parse(rawInitData);
}

export const tmaAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const [authType, authData = ""] = (c.req.header("authorization") ?? "").split(" ");

  if (authType === "tma" && authData && config.BOT_TOKEN) {
    try {
      c.set("tmaInitData", parseValidInitData(authData, config.BOT_TOKEN));
    } catch {
      return c.json({ error: "Невалидная или просроченная подпись Telegram initData" }, 401);
    }
    return next();
  }

  if (config.isProduction) {
    return c.json({ error: "Требуется авторизация Telegram Mini App (Authorization: tma ...)" }, 401);
  }

  return next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.get("tmaInitData")?.user?.id;
  if (userId === undefined) {
    if (config.isProduction) return c.json({ error: "Требуется авторизация администратора" }, 401);
    return next();
  }
  if (!config.adminIds.has(userId)) return c.json({ error: "Недостаточно прав" }, 403);
  return next();
});
