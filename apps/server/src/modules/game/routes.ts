import { Hono } from "hono";
import type { AppEnv } from "../../shared/app-env.js";
import { snapshotResponse } from "../../shared/route-context.js";

export const gameRouter = new Hono<AppEnv>().get("/state", (c) => snapshotResponse(c));
