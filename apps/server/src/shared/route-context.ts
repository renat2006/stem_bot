import type { Context } from "hono";
import type { MutationOptions } from "../modules/event/mutation.js";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { buildLiveState, buildRules } from "../modules/event/snapshot.js";
import type { AppEnv } from "./app-env.js";
import { DomainError } from "./errors.js";
import { runtime } from "./runtime.js";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

export async function currentEventId() {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) throw new DomainError("Активное событие не найдено", 404);
  return eventId;
}

export async function mutationOptions(c: Context<AppEnv>): Promise<MutationOptions> {
  const actor = c.get("identity");
  if (!actor) throw new DomainError("Откройте приложение из Telegram", 401);
  const key = c.req.header("idempotency-key");
  return {
    eventId: await currentEventId(),
    actor,
    idempotencyKey: key && IDEMPOTENCY_KEY.test(key) ? key : undefined,
  };
}

export async function stateResponse(c: Context<AppEnv>, eventId: string) {
  return c.json(await buildLiveState(runtime().db, eventId, c.get("identity")));
}

export async function snapshotResponse(c: Context<AppEnv>) {
  const eventId = await currentEventId();
  const { db } = runtime();
  const [state, event] = await Promise.all([
    buildLiveState(db, eventId, c.get("identity")),
    loadEvent(db, eventId),
  ]);
  return c.json({ ...state, ...buildRules(event) });
}
