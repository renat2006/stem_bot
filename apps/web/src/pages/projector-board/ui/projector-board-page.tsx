import {
  resolveDayEngine,
  resolveLexicon,
  resolveMissionDay,
  TeamRoundStateSchema,
  usesPhysicalBoard,
} from "@stem/shared";
import { Award, Check, Circle, Flame } from "lucide-react";
import { AssemblyStage, PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { GameSnapshot } from "../../../entities/game/index.js";
import { useCountdown } from "../../../shared/lib/index.js";
import { RarityBadge, SpiralBoard, TabletopBoard } from "../../../shared/ui/index.js";

const PHASE_LABEL: Record<string, string> = {
  scoring: "Задача дня",
  market: "Мастерская открыта",
  turn: "Испытание раунда",
  summary: "Разбор и итоги дня",
};

export function ProjectorBoardPage({
  snapshot,
  clockOffsetMs,
}: {
  snapshot: GameSnapshot;
  clockOffsetMs: number;
}) {
  const { template, gameState, teams, auctions, listings, feed } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const missionDay =
    snapshot.currentMissionDay?.day === gameState.currentDay
      ? snapshot.currentMissionDay
      : resolveMissionDay(template, gameState.currentDay);
  const roundMode = gameState.roundMode ?? "idle";
  const dayEngine = gameState.roundEngine ?? resolveDayEngine(template, gameState.currentDay);

  const physical = usesPhysicalBoard(template, dayEngine);
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const secondsLeft = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const openAuction = auctions.find((a) => a.status === "open");
  const auctionCard = openAuction ? template.cards.find((c) => c.id === openAuction.cardId) : undefined;
  const auctionSeconds = useCountdown(openAuction?.endsAt ?? null, clockOffsetMs);

  const phaseTimer = gameState.phaseEndsAt
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
    : null;

  const revealedCondition =
    missionDay.conditions.find((c) => c.id === gameState.revealedConditionId) ?? missionDay.conditions[0];

  const isProgram = roundMode === "blind_draft" || roundMode === "negotiation";

  return (
    <article className="hall-canvas">
      <div className="hall-stage">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#466353] pb-4">
          <div>
            <p className="text-base font-semibold text-mu">
              Полевой атлас · {template.title} · День {gameState.currentDay} из {template.totalDays}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
              {roundMode === "revealed" && revealedCondition
                ? `${lexicon.environmentLabel}: ${revealedCondition.label}`
                : isProgram
                  ? missionDay.title
                  : (PHASE_LABEL[gameState.currentPhase] ?? template.title)}
            </h1>
          </div>

          {phaseTimer && (
            <strong className="font-mono text-5xl font-extrabold tracking-tight text-ac tabular-nums sm:text-6xl">
              {phaseTimer}
            </strong>
          )}
        </header>

        {isProgram && (
          <section className="space-y-5" aria-label="Синхронное программирование экипажей">
            <div className="hall-timeline">
              {[
                { name: "Личный черновик", grow: 30, active: roundMode === "blind_draft" },
                { name: "Переговоры пятёрки", grow: 75, active: roundMode === "negotiation" },
                {
                  name: "Фиксация перед вскрытием",
                  grow: 15,
                  active: roundMode === "negotiation" && secondsLeft <= 15 && secondsLeft > 0,
                },
              ].map((z) => (
                <div key={z.name} style={{ flexGrow: z.grow }} data-active={z.active}>
                  <i />
                  <span className="text-sm font-bold text-fg">{z.name}</span>
                </div>
              ))}
            </div>

            <div className="hall-grid">
              {teams.map((team) => {
                const rs = TeamRoundStateSchema.parse(team.roundState ?? {});
                return (
                  <div key={team.id}>
                    <h2 className="text-2xl font-bold text-fg">{team.name}</h2>
                    <div className="mt-2 flex items-center gap-1.5 text-ac">
                      {[0, 1, 2, 3, 4].map((slot) =>
                        rs.readySlots.includes(slot) ? (
                          <Check key={slot} className="h-5 w-5" />
                        ) : (
                          <Circle key={slot} className="h-5 w-5 text-[#668273]" />
                        ),
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-mu">Подтверждено: {rs.readySlots.length} из 5</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {roundMode === "revealed" && (
          <section className="space-y-4" aria-label="Итоги вскрытия условия среды">
            <div className="hall-grid">
              {ranked.map((team) => {
                const rs = TeamRoundStateSchema.parse(team.roundState ?? {});
                return (
                  <div key={team.id}>
                    <h2 className="text-2xl font-bold text-fg">{team.name}</h2>
                    <strong className="mt-1 block font-mono text-4xl font-extrabold tracking-tight text-ac tabular-nums">
                      +{rs.lastRoundPoints}
                    </strong>
                    <p className="mt-1 text-sm text-mu">
                      {missionDay.routesA.find((r) => r.id === rs.orders.routeId)?.label} · резерв{" "}
                      {rs.orders.reserveTarget}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-fg">
                      Сезон · {team.trackPosition}/{template.trackMax}
                    </p>
                  </div>
                );
              })}
            </div>

            {template.features.openMilestones !== false && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#466353] pt-3 text-sm text-ac">
                <span className="inline-flex items-center gap-2 font-bold">
                  <Award className="h-5 w-5" />
                  Открытые инженерные вехи смены (доступны всем командам одновременно)
                </span>
                <span className="text-fg">
                  Награждаются за чистый проход обоих участков и точную диагностику
                </span>
              </footer>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-8">
            {physical && template.boardCells.length === 16 ? (
              <div className="hall-spiral-plate">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Квадрат событий</h2>
                    <p className="mt-0.5 text-sm text-mu">
                      Внешнее кольцо 1–16 определяет событие хода · внутри {template.trackName} (1–
                      {template.trackMax})
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums">Финиш: {template.trackMax}</span>
                </div>
                <TabletopBoard
                  template={template}
                  boardTokens={ranked.map((t) => ({ id: t.id, name: t.name, position: t.boardPosition }))}
                  spiralTokens={ranked.map((t) => ({ id: t.id, name: t.name, position: t.trackPosition }))}
                />
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  {ranked.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-lg border border-ln bg-sf px-2.5 py-1 text-fg tabular-nums"
                    >
                      {t.name}: кл. {t.boardPosition} · Спираль {t.trackPosition}/{template.trackMax}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hall-spiral-plate">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    {template.trackName}
                    {!physical &&
                      dayEngine !== "legacy_track" &&
                      ` (${dayEngine === "diagnosis" ? lexicon.diagnosisLabel : lexicon.programLabel})`}
                  </h2>
                  <span className="font-mono text-xs font-bold tabular-nums">Финиш: {template.trackMax}</span>
                </div>
                <SpiralBoard
                  labels={Array.from({ length: template.trackMax }, (_, i) => String(i + 1))}
                  tokens={ranked.map((t) => ({
                    id: t.id,
                    name: t.name,
                    position: t.trackPosition,
                  }))}
                  spiral
                />
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  {ranked.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-lg border border-ln bg-sf px-2.5 py-1 text-fg tabular-nums"
                    >
                      {t.name}: {t.trackPosition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ranked.slice(0, 4).map((team) => (
                <div key={team.id} className="rounded-xl border border-[#3f5d4f] bg-sf p-3">
                  <AssemblyStage
                    template={template}
                    equipped={team.equippedCards}
                    size="card"
                    teamName={team.name}
                  />
                  <div className="mt-2 flex items-baseline justify-between">
                    <strong className="truncate text-sm font-bold text-fg">{team.name}</strong>
                    <span className="font-mono text-sm font-bold text-ac">
                      {team.trackPosition}/{template.trackMax}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4 lg:col-span-4">
            {openAuction && auctionCard && (
              <div className="space-y-3 rounded-2xl border-2 border-[#c7f67c] bg-sf p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ac">
                    <Flame className="h-4 w-4" />
                    Живой аукцион
                  </span>
                  <span className="font-mono text-xl font-bold text-fg">
                    {Math.floor(auctionSeconds / 60)}:{String(auctionSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <PartSticker card={auctionCard} template={template} thumbnail />
                  <div>
                    <RarityBadge rarity={auctionCard.rarity} compact />
                    <h3 className="mt-1 text-lg font-bold text-fg">{auctionCard.name}</h3>
                    <StatDeltaList stats={template.stats} deltas={auctionCard.stats} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#11231c] px-4 py-3">
                  <span className="text-sm text-mu">
                    {openAuction.leaderTeamName
                      ? `Лидер: «${openAuction.leaderTeamName}»`
                      : "Ждём первую ставку"}
                  </span>
                  <span className="font-mono text-2xl font-bold text-ac">
                    {openAuction.currentBid} {lexicon.currencyUnit}
                  </span>
                </div>
              </div>
            )}

            {template.features.p2pMarket && listings.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-[#3f5d4f] bg-sf p-4">
                <h3 className="text-sm font-bold text-fg">Биржа команд</h3>
                {listings.slice(0, 4).map((listing) => {
                  const card = template.cards.find((c) => c.id === listing.cardId);
                  return (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between rounded-xl bg-[#11231c] px-3 py-2 text-xs"
                    >
                      <span className="truncate font-medium text-fg">
                        {card?.name ?? "Модуль"} · от «{listing.sellerTeamName}»
                      </span>
                      <span className="font-mono font-bold text-ac">
                        {listing.price} {lexicon.currencyUnit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2.5 rounded-2xl border border-[#3f5d4f] bg-sf p-4">
              <h3 className="text-sm font-bold text-fg">Прямой эфир событий</h3>
              <ul className="space-y-2 text-xs">
                {feed.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="rounded-xl bg-[#11231c] px-3 py-2 leading-snug text-fg">
                    {entry.text}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
