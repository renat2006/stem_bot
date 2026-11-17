import { BookOpen, ChevronRight } from "lucide-react";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import { StatGrid, StepBlocks, TrackProgress } from "../../../entities/team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { formatStatValue, ModuleCard, StatGlyph } from "../../../shared/ui/index.js";
import { EventFeed } from "../../../widgets/event-feed/index.js";
import { ProposalsInbox } from "../../../widgets/proposals-inbox/index.js";
import { SlotBuild } from "../../../widgets/slot-build/index.js";
import { TeamSummary } from "../../../widgets/team-summary/index.js";
import type { HelpKey } from "../lib/rules-sections.js";

interface HomeScreenProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  secondsLeft: number | null;
  marketOpen: boolean;
  isCaptain: boolean;
  run: RunAction;
  onHelp: (key: HelpKey) => void;
  onOpenMarket: (slotId: string) => void;
  onOpenTrack: () => void;
  onOpenLore: () => void;
  onToast: (text: string) => void;
}

export function HomeScreen({
  snapshot,
  team,
  secondsLeft,
  marketOpen,
  isCaptain,
  run,
  onHelp,
  onOpenMarket,
  onOpenTrack,
  onOpenLore,
  onToast,
}: HomeScreenProps) {
  const { template, gameState, teams } = snapshot;
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const rank = Math.max(1, ranked.findIndex((t) => t.id === team.id) + 1);
  const extra = template.extraModule;
  const extraStat = extra ? template.stats.find((s) => s.id === extra.statId) : undefined;
  const extraVal = extra ? (team.computedStats.total[extra.statId] ?? 0) : 0;
  const extraOk = extra ? extraVal >= extra.min : true;
  const limit = gameState.dailyPurchaseLimit;
  const leftBuys = limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - team.purchasesToday);

  const dayBriefing =
    template.features.storyBriefings &&
    (template.dayBriefings.find((b) => b.day === gameState.currentDay) ??
      template.dayBriefings.find((b) => b.day === 0));

  return (
    <div className="space-y-3">
      {dayBriefing && (
        <button
          type="button"
          onClick={onOpenLore}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ac/35 bg-ac/8 px-3.5 py-3 text-left transition active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ac text-acfg">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ac">
                Легенда дня {gameState.currentDay}
              </p>
              <p className="truncate text-sm font-semibold text-fg">{dayBriefing.title}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-mu" />
        </button>
      )}

      <TeamSummary
        team={team}
        template={template}
        gameState={gameState}
        teamRank={rank}
        totalTeams={teams.length}
        secondsLeft={secondsLeft}
        isCaptain={isCaptain}
      />

      <ProposalsInbox
        proposals={snapshot.proposals}
        p2pListings={snapshot.listings}
        team={team}
        template={template}
        isCaptain={isCaptain}
        marketOpen={marketOpen}
        run={run}
      />

      <SlotBuild
        team={team}
        template={template}
        gameState={gameState}
        isCaptain={isCaptain}
        marketOpen={marketOpen}
        run={run}
        onSelectEmptySlot={onOpenMarket}
        onHelp={() => onHelp("build")}
        onToast={onToast}
      />

      {extra && extraStat && (
        <ModuleCard
          title={extra.tag}
          badge={
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${
                extraOk ? "border-pos/30 bg-pos/10 text-pos" : "border-warn/30 bg-warn/10 text-warn"
              }`}
            >
              {extraOk ? extra.okLabel : extra.badLabel}
            </span>
          }
          onHelp={() => onHelp("extra")}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-fg">{extra.title}</span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-mu">
              <StatGlyph shape={extraStat.shape} color={extraStat.color} size={11} />
              {extraStat.label}: {formatStatValue(extraVal)} (нужно {extra.min})
            </span>
          </div>
        </ModuleCard>
      )}

      <ModuleCard
        title="Характеристики и прогноз хода"
        subtitle={`клетка ${team.trackPosition} → ${Math.min(template.trackMax, team.trackPosition + team.computedStats.step.total)}`}
        onHelp={() => onHelp("step")}
      >
        <div className="space-y-4">
          <StatGrid
            stats={template.stats}
            values={team.computedStats.total}
            template={template}
            activePerkId={team.activePerkId}
          />
          <div className="border-t border-ln pt-3.5">
            <StepBlocks step={team.computedStats.step} stats={template.stats} />
          </div>
          <TrackProgress
            label={template.trackName}
            position={team.trackPosition}
            max={template.trackMax}
            stepForecast={team.computedStats.step.total}
            rivalPositions={teams.filter((t) => t.id !== team.id).map((t) => t.trackPosition)}
          />
        </div>
      </ModuleCard>

      <EventFeed
        feed={snapshot.feed.slice(0, 6)}
        teams={teams}
        title="Лента событий"
        emptyText="Здесь появятся начисления, сделки и ходы команд"
      />

      <button
        type="button"
        onClick={() => (marketOpen && leftBuys > 0 ? onOpenMarket("all") : onOpenTrack())}
        className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg transition active:scale-[0.99]"
      >
        {marketOpen && leftBuys > 0 ? "Перейти на торговую площадку" : "Смотреть маршрут и рейтинг"}
      </button>
    </div>
  );
}
