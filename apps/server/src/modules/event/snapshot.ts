import {
  type AuctionLot,
  analyzeLiveBalance,
  assignMemberLevers,
  CLASSIC_EVENT_CELLS,
  calculateTeamStats,
  DEFAULT_TEMPLATES,
  defaultPowerCircuit,
  type GameState,
  type GameTemplate,
  GameTemplateSchema,
  type LiveState,
  type P2PListing,
  type RoundLiveMode,
  type RulesPayload,
  resolveDayEngine,
  resolveDiagnosisDay,
  resolveLexicon,
  resolveMissionDay,
  type Team,
  type TeamMemberInfo,
  TeamRoundStateSchema,
  validateGameBalance,
  validateParetoStrategies,
} from "@stem/shared";
import type { Db } from "../../db/client.js";
import type { EventRow, MemberRow, TeamRow } from "../../db/schema.js";
import { config } from "../../shared/config.js";
import type { Identity } from "../../shared/identity.js";
import { describeLedger } from "./feed-text.js";
import { loadEventGraph, type Reader, settleExpiredAuctions } from "./repository.js";

export function isMarketOpen(event: Pick<EventRow, "currentPhase" | "phaseEndsAt">, now = new Date()) {
  return event.currentPhase === "market" && (!event.phaseEndsAt || event.phaseEndsAt > now);
}

export function normalizeTemplate(raw: GameTemplate): GameTemplate {
  const parsed = GameTemplateSchema.parse(raw);
  const boardCells =
    parsed.eventKey === "neurofauna" &&
    parsed.boardCells.length === 6 &&
    parsed.boardCells[5]?.type === "apex"
      ? CLASSIC_EVENT_CELLS
      : parsed.boardCells;
  return { ...parsed, boardCells, artPackId: parsed.artPackId ?? parsed.eventKey };
}

export function resolveEffectiveRoundMode(
  event: Pick<EventRow, "roundState">,
  now = new Date(),
): RoundLiveMode {
  const rawMode = event.roundState?.mode ?? "idle";
  if (rawMode === "blind_draft" && event.roundState?.blindEndsAt) {
    const blindEnd = Date.parse(event.roundState.blindEndsAt);
    if (!Number.isNaN(blindEnd) && now.getTime() >= blindEnd) {
      return "negotiation";
    }
  }
  return rawMode;
}

export function toTeam(
  row: TeamRow,
  teamMembers: MemberRow[],
  template: GameTemplate,
  revealCode: boolean,
): Team {
  const captain = teamMembers.find((m) => m.role === "captain");
  const equippedCards = Object.fromEntries(template.slots.map((s) => [s.id, row.equipped[s.id] ?? null]));
  const roundState = TeamRoundStateSchema.parse(row.roundState ?? {});
  return {
    id: row.id,
    name: row.name,
    monogram: row.monogram,
    joinCode: revealCode ? row.joinCode : "",
    captainUsername: captain?.displayName ?? "",
    members: teamMembers.map((m) => m.displayName.trim().charAt(0).toUpperCase() || "•"),
    currency: row.currency,
    heldCurrency: row.heldCurrency ?? 0,
    trackPosition: row.trackPosition,
    boardPosition: row.boardPosition,
    purchasesToday: row.purchasesToday,
    equippedCards,
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    badges: Array.isArray(row.badges) ? row.badges : [],
    activePerkId: row.activePerkId,
    statModifiers: row.statModifiers,
    roundState,
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
  if ("transaction" in db) {
    await settleExpiredAuctions(db as Db, eventId).catch(() => false);
  }
  return shapeLiveState(await loadGraph(db, eventId), identity);
}

export function shapeLiveState(graph: EventGraph, identity?: Identity): LiveState {
  const { event } = graph;
  const template = normalizeTemplate(event.template);
  const now = new Date();
  const member = identity ? (graph.memberRows.find((m) => m.userId === identity.userId) ?? null) : null;
  const isAdmin = identity?.isAdmin ?? false;

  const membersByTeam = new Map<string, MemberRow[]>();
  for (const m of graph.memberRows) {
    membersByTeam.set(m.teamId, [...(membersByTeam.get(m.teamId) ?? []), m]);
  }
  const teamNames = new Map(graph.teamRows.map((t) => [t.id, t.name]));
  const leaderPos = graph.teamRows.reduce((max, r) => Math.max(max, r.trackPosition), 1);

  const plainTeams = graph.teamRows.map((row) =>
    toTeam(row, membersByTeam.get(row.id) ?? [], template, isAdmin || row.id === member?.teamId),
  );
  const teams = plainTeams.map((team) => ({
    ...team,
    computedStats: calculateTeamStats(team, template, leaderPos),
  }));

  const listings: P2PListing[] = graph.listingRows.map((row) => ({
    id: row.id,
    sellerTeamId: row.sellerTeamId,
    sellerTeamName: teamNames.get(row.sellerTeamId) ?? "Команда",
    cardId: row.cardId,
    price: row.price,
    createdAt: row.createdAt.toISOString(),
  }));

  const auctions: AuctionLot[] = graph.auctionRows.map((row) => ({
    id: row.id,
    cardId: row.cardId,
    startingPrice: row.startingPrice,
    currentBid: row.currentBid,
    leaderTeamId: row.leaderTeamId,
    leaderTeamName: row.leaderTeamId ? (teamNames.get(row.leaderTeamId) ?? "Команда") : null,
    bidCount: row.bidCount,
    endsAt: row.endsAt.toISOString(),
    status: row.status,
  }));

  const roundMode = resolveEffectiveRoundMode(event, now);
  const roundEngine = resolveDayEngine(template, event.currentDay);
  const revealedConditionId =
    roundMode === "revealed" ? (event.roundState?.revealedConditionId ?? null) : null;

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
    roundMode,
    roundEngine,
    revealedConditionId,
    canUndoLastReward: Boolean(event.roundState?.lastRewardBatch?.length),
  };

  const liveBalance = analyzeLiveBalance({
    template,
    gameState,
    teams: plainTeams,
    listings,
    auctions,
  });

  const visibleMembers = isAdmin
    ? graph.memberRows
    : graph.memberRows.filter((m) => m.teamId === member?.teamId);
  const members: Record<string, TeamMemberInfo[]> = {};
  for (const m of visibleMembers) members[m.teamId] = [...(members[m.teamId] ?? []), toMemberInfo(m)];

  let assignedLevers: number[] = [0, 1, 2, 3, 4];
  if (member) {
    const myTeamMembers = membersByTeam.get(member.teamId) ?? [];
    const idx = Math.max(
      0,
      myTeamMembers.findIndex((m) => m.userId === member.userId),
    );
    assignedLevers = assignMemberLevers(idx, myTeamMembers.length, event.currentDay);
  }

  const feedRows = isAdmin
    ? graph.feedRows
    : graph.feedRows.filter((f) => !f.teamId || (member && f.teamId === member.teamId));

  return {
    eventId: event.id,
    version: event.version,
    serverTime: now.toISOString(),
    gameState,
    teams,
    listings,
    auctions,
    liveBalance,
    viewer: {
      userId: identity?.userId ?? null,
      displayName: member?.displayName ?? identity?.displayName ?? "",
      isAdmin,
      botSurface: identity?.botSurface ?? (isAdmin ? "admin" : "player"),
      teamId: member?.teamId ?? null,
      role: member?.role ?? null,
      assignedLevers,
      needsJoin: !member,
      isProduction: config.isProduction,
    },
    proposals: graph.proposalRows
      .filter((p) => p.teamId === member?.teamId)
      .map((p) => ({
        id: p.id,
        teamId: p.teamId,
        cardId: p.cardId,
        listingId: p.listingId ?? null,
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

export function buildRules(
  event: Pick<EventRow, "template" | "rulesVersion" | "currentDay">,
  isAdmin = false,
): RulesPayload {
  const rawTemplate = normalizeTemplate(event.template);
  const day = event.currentDay ?? 1;
  const sanitizedTemplate: GameTemplate = isAdmin
    ? rawTemplate
    : {
        ...rawTemplate,
        diagnosisDays: rawTemplate.diagnosisDays.map((d) => ({
          ...d,
          secretHypothesisId: "hidden",
          probes: d.probes.map((p) => ({ ...p, resultByHypothesis: {} })),
        })),
      };
  const s0 = rawTemplate.stats[0]?.id ?? "speed";
  const s1 = rawTemplate.stats[1]?.id ?? s0;
  const s2 = rawTemplate.stats[2]?.id ?? s1;
  const missionDay = resolveMissionDay(rawTemplate, day);
  return {
    rulesVersion: event.rulesVersion,
    template: sanitizedTemplate,
    availableTemplates: DEFAULT_TEMPLATES.map(
      ({ id, title, theme, eventTag, objectName, totalDays, currencyName, currencyIcon }) => ({
        id,
        title,
        theme,
        eventTag,
        objectName,
        totalDays,
        currencyName,
        currencyIcon,
      }),
    ),
    balanceReport: validateGameBalance(rawTemplate),
    lexicon: resolveLexicon(rawTemplate),
    currentMissionDay: missionDay,
    currentDiagnosisDay: resolveDiagnosisDay(rawTemplate, day, !isAdmin),
    paretoCheck: validateParetoStrategies({
      day: missionDay,
      referenceStats: { [s0]: 4, [s1]: 5, [s2]: 4 },
      circuit: defaultPowerCircuit(rawTemplate),
    }),
  };
}
