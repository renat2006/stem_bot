import { Compass, Flame, Sparkles, Trophy } from "lucide-react";
import { AssemblyStage, PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { GameSnapshot } from "../../../entities/game/index.js";
import { useCountdown } from "../../../shared/lib/index.js";
import { Coin, formatStatValue, RarityBadge, StatGlyph } from "../../../shared/ui/index.js";

const PHASE_LABEL: Record<string, string> = {
  scoring: "Начисление валюты",
  market: "Открыт рынок деталей",
  turn: "Ход на маршруте",
  summary: "Итоги дня",
};

export function ProjectorBoardPage({
  snapshot,
  clockOffsetMs,
}: {
  snapshot: GameSnapshot;
  clockOffsetMs: number;
}) {
  const { template, gameState, teams, auctions, listings, feed } = snapshot;
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const secondsLeft = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const openAuction = auctions.find((a) => a.status === "open");
  const auctionCard = openAuction ? template.cards.find((c) => c.id === openAuction.cardId) : undefined;
  const auctionSeconds = useCountdown(openAuction?.endsAt ?? null, clockOffsetMs);
  const activeBriefing =
    template.dayBriefings.find((b) => b.day === gameState.currentDay) ??
    template.dayBriefings.find((b) => b.day === 0);

  const phaseTimer = gameState.phaseEndsAt
    ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="mx-auto min-h-dvh max-w-[1480px] space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ln bg-sf px-6 py-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-[0.08em] uppercase text-ac">
            <Sparkles className="h-4 w-4" />
            {template.eventTag} · День {gameState.currentDay} из {template.totalDays}
          </span>
          <h1 className="text-3xl font-bold text-fg">{template.title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-sf2 px-4 py-2.5 text-right">
            <p className="text-xs text-mu">Текущая фаза</p>
            <p className="text-lg font-semibold text-fg">
              {PHASE_LABEL[gameState.currentPhase] ?? gameState.currentPhase}
            </p>
          </div>
          {phaseTimer && (
            <div className="rounded-xl border border-ac/40 bg-ac/12 px-5 py-2 text-center">
              <p className="text-[11px] font-medium text-ac">До конца окна</p>
              <p className="font-mono text-3xl font-bold text-fg">{phaseTimer}</p>
            </div>
          )}
        </div>
      </header>

      {activeBriefing && template.features.storyBriefings && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ac/30 bg-ac/8 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Compass className="h-6 w-6 shrink-0 text-ac" />
            <div>
              <p className="text-sm font-semibold text-fg">{activeBriefing.title}</p>
              <p className="text-xs text-mu">{activeBriefing.story}</p>
            </div>
          </div>
          {activeBriefing.challengeTitle && (
            <span className="rounded-xl border border-ac/40 bg-sf px-3.5 py-1.5 text-xs font-semibold text-fg">
              Задача: {activeBriefing.challengeTitle}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-fg">
              <Trophy className="h-5 w-5 text-ac" />
              Маршрут «{template.trackName}»
            </h2>
            <span className="font-mono text-xs text-mu">Финиш: {template.trackMax} клеток</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {ranked.map((team, idx) => {
              const pct = Math.min(100, (team.trackPosition / template.trackMax) * 100);
              const nextPct = Math.min(
                100,
                ((team.trackPosition + team.computedStats.step.total) / template.trackMax) * 100,
              );
              return (
                <div
                  key={team.id}
                  className="grid grid-cols-[auto_120px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-ln bg-sf p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ac font-mono text-xl font-bold text-acfg">
                    {idx + 1}
                  </div>
                  <div className="flex justify-center">
                    <AssemblyStage
                      template={template}
                      equipped={team.equippedCards}
                      size="card"
                      teamName={team.name}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-semibold text-fg">{team.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-mu">
                          {template.stats.map((stat) => (
                            <span key={stat.id} className="flex items-center gap-1 font-mono">
                              <StatGlyph shape={stat.shape} color={stat.color} size={10} />
                              {stat.label}:{" "}
                              <strong className="text-fg">
                                {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-2xl font-bold text-fg">
                          {team.trackPosition}
                          <span className="text-sm font-normal text-mu">/{template.trackMax}</span>
                        </span>
                        <p className="font-mono text-xs font-semibold text-ac">
                          прогноз +{team.computedStats.step.total}
                        </p>
                      </div>
                    </div>

                    <div className="relative h-3.5 overflow-hidden rounded-full bg-sf2">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-ac opacity-25"
                        style={{ width: `${nextPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-ac transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          {openAuction && auctionCard && (
            <div className="space-y-3 rounded-2xl border-2 border-warn/60 bg-sf p-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
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
              <div className="flex items-center justify-between rounded-xl bg-sf2 px-4 py-3">
                <span className="text-sm text-mu">
                  {openAuction.leaderTeamName
                    ? `Лидер: «${openAuction.leaderTeamName}»`
                    : "Ждём первую ставку"}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-2xl font-bold text-fg">
                  {openAuction.currentBid}
                  <Coin size={18} />
                </span>
              </div>
            </div>
          )}

          {template.features.p2pMarket && listings.length > 0 && (
            <div className="space-y-2.5 rounded-2xl border border-ln bg-sf p-4">
              <h3 className="text-sm font-semibold text-fg">Биржа команд</h3>
              {listings.slice(0, 4).map((listing) => {
                const card = template.cards.find((c) => c.id === listing.cardId);
                return (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between rounded-xl bg-sf2 px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-fg">
                      {card?.name ?? "Модуль"} · от «{listing.sellerTeamName}»
                    </span>
                    <span className="flex items-center gap-1 font-mono font-semibold text-fg">
                      {listing.price}
                      <Coin size={12} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2.5 rounded-2xl border border-ln bg-sf p-4">
            <h3 className="text-sm font-semibold text-fg">Прямой эфир событий</h3>
            <ul className="space-y-2 text-xs">
              {feed.slice(0, 8).map((entry) => (
                <li key={entry.id} className="rounded-xl bg-sf2 px-3 py-2 leading-snug text-fg">
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
