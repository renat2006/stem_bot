import { isValid, parse, validate } from "@tma.js/init-data-node";
import type { Context, Next } from "hono";

export function verifyTelegramInitData(rawInitData: string, botToken: string): boolean {
  if (!rawInitData || !botToken) return false;
  return isValid(rawInitData, botToken);
}

export function validateAndParseInitData(rawInitData: string, botToken: string) {
  validate(rawInitData, botToken, { expiresIn: 3600 });
  return parse(rawInitData);
}

export async function tmaAuthMiddleware(c: Context, next: Next) {
  const botToken = process.env.BOT_TOKEN ?? "";
  const isProd = process.env.NODE_ENV === "production";
  const authHeader = c.req.header("authorization") ?? "";
  const [authType, authData = ""] = authHeader.split(" ");

  if (authType === "tma" && authData && botToken && botToken !== "your_telegram_bot_token_here") {
    try {
      const initData = validateAndParseInitData(authData, botToken);
      c.set("tmaInitData", initData);
      return await next();
    } catch {
      return c.json({ error: "Невалидная или просроченная подпись Telegram initData" }, 401);
    }
  }

  if (isProd) {
    return c.json({ error: "Требуется авторизация Telegram Mini App (Authorization: tma ...)" }, 401);
  }

  return await next();
}
