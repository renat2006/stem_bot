import { and, eq } from "drizzle-orm";
import type { Tx } from "../../db/client.js";
import { commands, type EventRow, events, ledger } from "../../db/schema.js";
import { DomainError } from "../../shared/errors.js";
import type { Identity } from "../../shared/identity.js";
import { runtime } from "../../shared/runtime.js";

export interface LedgerDraft {
  teamId?: string | null;
  kind: string;
  amount?: number | null;
  data?: Record<string, unknown>;
}

export interface MutationContext {
  tx: Tx;
  event: EventRow;
  actor: Identity;
  log: (entry: LedgerDraft) => void;
  rulesChanged: () => void;
}

export interface MutationOptions {
  eventId: string;
  actor: Identity;
  idempotencyKey?: string;
}

export async function mutateEvent<T>(
  { eventId, actor, idempotencyKey }: MutationOptions,
  apply: (ctx: MutationContext) => Promise<T>,
): Promise<T> {
  const { db, hub } = runtime();
  let rules = false;

  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
    if (!event) throw new DomainError("Событие не найдено", 404);

    if (idempotencyKey) {
      const [previous] = await tx
        .select({ result: commands.result })
        .from(commands)
        .where(and(eq(commands.eventId, eventId), eq(commands.key, idempotencyKey)));
      if (previous) return { replayed: true, value: previous.result as T };
    }

    const drafts: LedgerDraft[] = [];
    const value = await apply({
      tx,
      event,
      actor,
      log: (entry) => drafts.push(entry),
      rulesChanged: () => {
        rules = true;
      },
    });

    const version = event.version + 1;
    await tx.update(events).set({ version }).where(eq(events.id, eventId));
    if (drafts.length > 0) {
      await tx.insert(ledger).values(
        drafts.map((d) => ({
          eventId,
          version,
          teamId: d.teamId ?? null,
          kind: d.kind,
          amount: d.amount ?? null,
          data: d.data ?? {},
          actorUserId: actor.userId,
        })),
      );
    }
    if (idempotencyKey) {
      await tx
        .insert(commands)
        .values({ eventId, key: idempotencyKey, userId: actor.userId, result: value ?? null });
    }
    return { replayed: false, value };
  });

  if (!outcome.replayed) hub.publish(eventId, { rules });
  return outcome.value;
}
