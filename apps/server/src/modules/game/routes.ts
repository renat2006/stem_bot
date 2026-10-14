import { Hono } from "hono";
import type { AppEnv } from "../../shared/app-env.js";
import { getGameSnapshot } from "./service.js";

export const gameRouter = new Hono<AppEnv>().get("/state", (c) => {
  const user = c.get("tmaInitData")?.user;
  return c.json(
    getGameSnapshot({
      id: user?.id,
      username: user?.username,
    }),
  );
});
