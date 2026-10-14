import { and, eq } from "drizzle-orm";
import type { Tx } from "../../db/client.js";
import { members, teams } from "../../db/schema.js";
import { DomainError } from "../../shared/errors.js";
import type { Identity } from "../../shared/identity.js";

export async function requireMember(tx: Tx, eventId: string, identity: Identity) {
  const [member] = await tx
    .select()
    .from(members)
    .where(and(eq(members.eventId, eventId), eq(members.userId, identity.userId)));
  if (!member) throw new DomainError("Сначала присоединитесь к команде по коду", 403);
  const [team] = await tx.select().from(teams).where(eq(teams.id, member.teamId));
  if (!team) throw new DomainError("Команда не найдена", 404);
  return { member, team };
}

export async function requireCaptain(tx: Tx, eventId: string, identity: Identity) {
  const access = await requireMember(tx, eventId, identity);
  if (access.member.role !== "captain") {
    throw new DomainError("Покупки делает капитан. Предложите карту капитану", 403);
  }
  return access;
}

export async function requireTeam(tx: Tx, eventId: string, teamId: string) {
  const [team] = await tx
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.id, teamId)));
  if (!team) throw new DomainError("Команда не найдена", 404);
  return team;
}
