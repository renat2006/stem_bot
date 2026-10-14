import { calculateTeamStats, DEFAULT_TEMPLATES, type ShiftPhase } from "@stem/shared";
import { and, eq, sql } from "drizzle-orm";
import { events, ledger, members, proposals, teams } from "../../db/schema.js";
import { DomainError } from "../../shared/errors.js";
import { requireTeam } from "../event/access.js";
import { type MutationOptions, mutateEvent } from "../event/mutation.js";
import { newTeamValues, resetEventContent } from "../event/seed.js";
import { toTeam } from "../event/snapshot.js";

export function rewardTeams(
  options: MutationOptions,
  input: { teamIds: string[]; amount: number; reason: string; comment?: string },
) {
  return mutateEvent(options, async (ctx) => {
    for (const teamId of new Set(input.teamIds)) {
      const team = await requireTeam(ctx.tx, ctx.event.id, teamId);
      const next = Math.max(0, team.currency + input.amount);
      await ctx.tx.update(teams).set({ currency: next }).where(eq(teams.id, team.id));
      ctx.log({
        teamId: team.id,
        kind: "reward",
        amount: next - team.currency,
        data: { reason: input.reason, comment: input.comment ?? null },
      });
    }
    return { teams: input.teamIds.length };
  });
}

export function adjustTrack(
  options: MutationOptions,
  input: { teamId: string; delta: number; reason?: string },
) {
  return mutateEvent(options, async (ctx) => {
    const team = await requireTeam(ctx.tx, ctx.event.id, input.teamId);
    const next = Math.min(ctx.event.template.trackMax, Math.max(1, team.trackPosition + input.delta));
    await ctx.tx.update(teams).set({ trackPosition: next }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "track",
      amount: next - team.trackPosition,
      data: { reason: input.reason ?? null },
    });
    return { trackPosition: next };
  });
}

export function setPhase(options: MutationOptions, input: { phase: ShiftPhase; minutes?: number | null }) {
  return mutateEvent(options, async (ctx) => {
    const phaseEndsAt = input.minutes ? new Date(Date.now() + input.minutes * 60_000) : null;
    await ctx.tx
      .update(events)
      .set({ currentPhase: input.phase, phaseEndsAt })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "phase", data: { phase: input.phase, minutes: input.minutes ?? null } });
    return { phase: input.phase, phaseEndsAt: phaseEndsAt?.toISOString() ?? null };
  });
}

export function updateSettings(options: MutationOptions, input: { purchaseLimit: number | null }) {
  return mutateEvent(options, async (ctx) => {
    await ctx.tx
      .update(events)
      .set({ purchaseLimit: input.purchaseLimit })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "settings", data: { purchaseLimit: input.purchaseLimit } });
    return { purchaseLimit: input.purchaseLimit };
  });
}

export function nextDay(options: MutationOptions) {
  return mutateEvent(options, async (ctx) => {
    const day = ctx.event.currentDay + 1;
    if (day > ctx.event.template.totalDays) throw new DomainError("Это был последний день смены");
    await ctx.tx
      .update(events)
      .set({ currentDay: day, currentPhase: "scoring", phaseEndsAt: null })
      .where(eq(events.id, ctx.event.id));
    await ctx.tx.update(teams).set({ purchasesToday: 0 }).where(eq(teams.eventId, ctx.event.id));
    ctx.log({ kind: "day", data: { day } });
    return { day };
  });
}

export function applyTurn(options: MutationOptions) {
  return mutateEvent(options, async (ctx) => {
    const day = ctx.event.currentDay;
    const [done] = await ctx.tx
      .select({ id: ledger.id })
      .from(ledger)
      .where(
        and(
          eq(ledger.eventId, ctx.event.id),
          eq(ledger.kind, "step"),
          sql`${ledger.data}->>'day' = ${String(day)}`,
        ),
      )
      .limit(1);
    if (done) throw new DomainError(`Ход дня ${day} уже применён`, 409);

    const template = ctx.event.template;
    const rows = await ctx.tx.select().from(teams).where(eq(teams.eventId, ctx.event.id));
    for (const row of rows) {
      const { step } = calculateTeamStats(toTeam(row, [], template, false), template);
      const to = Math.min(template.trackMax, row.trackPosition + step.total);
      await ctx.tx.update(teams).set({ trackPosition: to }).where(eq(teams.id, row.id));
      ctx.log({
        teamId: row.id,
        kind: "step",
        amount: to - row.trackPosition,
        data: { day, from: row.trackPosition, to },
      });
    }
    await ctx.tx
      .update(events)
      .set({ currentPhase: "summary", phaseEndsAt: null })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "phase", data: { phase: "summary" } });
    return { teams: rows.length };
  });
}

export function createTeam(options: MutationOptions, input: { name: string }) {
  return mutateEvent(options, async (ctx) => {
    const [{ count } = { count: 0 }] = await ctx.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.eventId, ctx.event.id));
    const values = newTeamValues(ctx.event.id, input.name.trim(), count, ctx.event.template);
    await ctx.tx.insert(teams).values(values);
    ctx.log({ teamId: values.id, kind: "team", data: { name: values.name } });
    return { teamId: values.id, joinCode: values.joinCode };
  });
}

export function setCaptain(options: MutationOptions, input: { teamId: string; userId: number }) {
  return mutateEvent(options, async (ctx) => {
    const team = await requireTeam(ctx.tx, ctx.event.id, input.teamId);
    const [target] = await ctx.tx
      .select()
      .from(members)
      .where(and(eq(members.teamId, team.id), eq(members.userId, input.userId)));
    if (!target) throw new DomainError("Участник не найден в команде", 404);
    await ctx.tx.update(members).set({ role: "member" }).where(eq(members.teamId, team.id));
    await ctx.tx
      .update(members)
      .set({ role: "captain" })
      .where(and(eq(members.teamId, team.id), eq(members.userId, input.userId)));
    ctx.log({ teamId: team.id, kind: "captain", data: { displayName: target.displayName } });
    return { teamId: team.id };
  });
}

export function removeMember(options: MutationOptions, input: { userId: number }) {
  return mutateEvent(options, async (ctx) => {
    await ctx.tx
      .delete(members)
      .where(and(eq(members.eventId, ctx.event.id), eq(members.userId, input.userId)));
    ctx.log({ kind: "member-removed", data: { userId: input.userId } });
    return { userId: input.userId };
  });
}

export function resetEvent(options: MutationOptions, input: { templateId?: string; demoTeams: boolean }) {
  return mutateEvent(options, async (ctx) => {
    const template = input.templateId
      ? DEFAULT_TEMPLATES.find((t) => t.id === input.templateId)
      : ctx.event.template;
    if (!template) throw new DomainError("Шаблон не найден", 404);
    await ctx.tx.delete(proposals).where(eq(proposals.eventId, ctx.event.id));
    await resetEventContent(ctx.tx, ctx.event.id, template, input.demoTeams);
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        title: template.title,
        template,
        currentDay: 1,
        currentPhase: "scoring",
        phaseEndsAt: null,
        purchaseLimit: template.dailyPurchaseLimit,
        rulesVersion,
        rulesNote: `Версия ${rulesVersion} · Старт смены «${template.title}»`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "reset", data: { templateId: template.id } });
    return { templateId: template.id };
  });
}
