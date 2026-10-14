import {
  calculateTeamStats,
  DEFAULT_TEMPLATES,
  type GameState,
  type GameTemplate,
  type LiveState,
  type RulesPayload,
  type Team,
  type TeamMemberInfo,
  validateGameBalance,
} from "@stem/shared";
import type { EventRow, MemberRow, TeamRow } from "../../db/schema.js";
import { config } from "../../shared/config.js";
import type { Identity } from "../../shared/identity.js";
import { describeLedger } from "./feed-text.js";
import { loadEventGraph, type Reader } from "./repository.js";

export function isMarketOpen(event: Pick<EventRow, "currentPhase" | "phaseEndsAt">, now = new Date()) {
  return event.currentPhase === "market" && (!event.phaseEndsAt || event.phaseEndsAt > now);
}

export function toTeam(
  row: TeamRow,
  teamMembers: MemberRow[],
  template: GameTemplate,
  revealCode: boolean,
): Team {
  const captain = teamMembers.find((m) => m.role === "captain");
  const equippedCards = Object.fromEntries(template.slots.map((s) => [s.id, row.equipped[s.id] ?? null]));
  return {
    id: row.id,
    name: row.name,
    monogram: row.monogram,
    joinCode: revealCode ? row.joinCode : "",
    captainUsername: captain?.displayName ?? "",
    members: teamMembers.map((m) => m.displayName.trim().charAt(0).toUpperCase() || "•"),
    currency: row.currency,
    trackPosition: row.trackPosition,
    boardPosition: 1,
    purchasesToday: row.purchasesToday,
    equippedCards,
    activePerkId: row.activePerkId,
    statModifiers: row.statModifiers,
  };
}

function toMemberInfo(m: MemberRow): TeamMemberInfo {
  return { userId: m.userId, displayName: m.displayName, username: m.username, role: m.role };
}

export type EventGraph = Awaited<ReturnType<typeof loadEventGraph>>;

export function loadGraph(db: Reader, eventId: string) {
  return loadEventGraph(db, eventId, null, true);
}

export async function buildLiveState(db: Reader, eventId: string, identity?: Identity): Promise<LiveState> {
  return shapeLiveState(await loadGraph(db, eventId), identity);
}

export function shapeLiveState(graph: EventGraph, identity?: Identity): LiveState {
  const { event } = graph;
  const template = event.template;
  const now = new Date();
  const member = identity ? (graph.memberRows.find((m) => m.userId === identity.userId) ?? null) : null;
  const isAdmin = identity?.isAdmin ?? false;

  const membersByTeam = new Map<string, MemberRow[]>();
  for (const m of graph.memberRows) membersByTeam.set(m.teamId, [...(membersByTeam.get(m.teamId) ?? []), m]);
  const teamNames = new Map(graph.teamRows.map((t) => [t.id, t.name]));

  const teams = graph.teamRows.map((row) => {
    const team = toTeam(row, membersByTeam.get(row.id) ?? [], template, isAdmin || row.id === member?.teamId);
    return { ...team, computedStats: calculateTeamStats(team, template) };
  });

  const gameState: GameState = {
    activeTemplateId: template.id,
    currentDay: event.currentDay,
    currentPoint: event.currentDay,
    currentPhase: event.currentPhase,
    purchasePhaseActive: isMarketOpen(event, now),
    dailyPurchaseLimit: event.purchaseLimit,
    secondsLeft: event.phaseEndsAt
      ? Math.max(0, Math.round((event.phaseEndsAt.getTime() - now.getTime()) / 1000))
      : 0,
    phaseEndsAt: event.phaseEndsAt?.toISOString() ?? null,
    rulesVersion: event.rulesVersion,
    rulesUpdatedNote: event.rulesNote,
    cardStockLeft: Object.fromEntries(graph.stockRows.map((s) => [s.cardId, s.left])),
    cardSoldTo: Object.fromEntries(
      graph.stockRows
        .filter((s) => s.left === 0 && s.soldToTeamId)
        .map((s) => [s.cardId, teamNames.get(s.soldToTeamId ?? "") ?? "другая команда"]),
    ),
  };

  const visibleMembers = isAdmin
    ? graph.memberRows
    : graph.memberRows.filter((m) => m.teamId === member?.teamId);
  const members: Record<string, TeamMemberInfo[]> = {};
  for (const m of visibleMembers) members[m.teamId] = [...(members[m.teamId] ?? []), toMemberInfo(m)];

  const feedRows = isAdmin
    ? graph.feedRows
    : graph.feedRows.filter((f) => member && f.teamId === member.teamId);

  return {
    eventId: event.id,
    version: event.version,
    serverTime: now.toISOString(),
    gameState,
    teams,
    viewer: {
      userId: identity?.userId ?? null,
      displayName: member?.displayName ?? identity?.displayName ?? "",
      isAdmin,
      teamId: member?.teamId ?? null,
      role: member?.role ?? null,
      needsJoin: !member,
      isProduction: config.isProduction,
    },
    proposals: graph.proposalRows
      .filter((p) => p.teamId === member?.teamId)
      .map((p) => ({
        id: p.id,
        teamId: p.teamId,
        cardId: p.cardId,
        fromName: p.fromName,
        createdAt: p.createdAt.toISOString(),
      })),
    feed: feedRows.slice(0, 40).map((f) => ({
      id: f.id,
      version: f.version,
      teamId: f.teamId,
      kind: f.kind,
      amount: f.amount,
      text: describeLedger(f, template),
      createdAt: f.createdAt.toISOString(),
    })),
    members,
  };
}

export function buildRules(event: Pick<EventRow, "template" | "rulesVersion">): RulesPayload {
  return {
    rulesVersion: event.rulesVersion,
    template: event.template,
    availableTemplates: DEFAULT_TEMPLATES.map(({ id, title, theme, currencyName, currencyIcon }) => ({
      id,
      title,
      theme,
      currencyName,
      currencyIcon,
    })),
    balanceReport: validateGameBalance(event.template),
  };
}
