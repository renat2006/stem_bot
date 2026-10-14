import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./app-env.js";
import { config } from "./config.js";
import { AuthError, identityFromDevUser, identityFromInitData } from "./identity.js";

export const identityMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const [authType, authData = ""] = (c.req.header("authorization") ?? "").split(" ");

  if (authType === "tma" && authData) {
    try {
      c.set("identity", identityFromInitData(authData));
    } catch (error) {
      const message = error instanceof AuthError ? error.message : "Ошибка авторизации";
      return c.json({ error: message }, 401);
    }
    return next();
  }

  const devIdentity = identityFromDevUser(c.req.header("x-dev-user") ?? "");
  if (devIdentity) {
    c.set("identity", devIdentity);
    return next();
  }

  if (config.isProduction) {
    return c.json({ error: "Требуется авторизация Telegram Mini App (Authorization: tma ...)" }, 401);
  }
  return next();
});

export const requireIdentity = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("identity")) return c.json({ error: "Откройте приложение из Telegram" }, 401);
  return next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const identity = c.get("identity");
  if (!identity) return c.json({ error: "Требуется авторизация администратора" }, 401);
  if (!identity.isAdmin) return c.json({ error: "Недостаточно прав" }, 403);
  return next();
});
