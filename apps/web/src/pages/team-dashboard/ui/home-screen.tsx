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

  return (
    <div className="space-y-3.5">
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
        onSelectEmptySlot={onOpenMarket}
        onHelp={() => onHelp("build")}
      />

      <ModuleCard
        title="Характеристики и пороги"
        badge={
          <span className="flex items-center gap-1.5 text-xs text-mu">
            <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-ac" />
            порог шага
          </span>
        }
        onHelp={() => onHelp("step")}
      >
        <StatGrid
          stats={template.stats}
          values={team.computedStats.total}
          template={template}
          activePerkId={team.activePerkId}
        />
      </ModuleCard>

      <ModuleCard
        title="Прогноз хода"
        subtitle={`клетка ${team.trackPosition} → ${Math.min(template.trackMax, team.trackPosition + team.computedStats.step.total)}`}
        onHelp={() => onHelp("step")}
      >
        <div className="space-y-4">
          <StepBlocks step={team.computedStats.step} stats={template.stats} />
          <TrackProgress
            label={template.trackName}
            position={team.trackPosition}
            max={template.trackMax}
            stepForecast={team.computedStats.step.total}
            rivalPositions={teams.filter((t) => t.id !== team.id).map((t) => t.trackPosition)}
          />
        </div>
      </ModuleCard>

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
            <span className="text-[15px] font-semibold text-fg">{extra.title}</span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-mu">
              <StatGlyph shape={extraStat.shape} color={extraStat.color} size={11} />
              {extraStat.label}: {formatStatValue(extraVal)} (порог {extra.min})
            </span>
          </div>
        </ModuleCard>
      )}

      <EventFeed
        feed={snapshot.feed.slice(0, 8)}
        teams={teams}
        title="Что произошло"
        emptyText="Здесь появятся начисления и покупки команды"
      />

      <button
        type="button"
        onClick={() => (marketOpen && leftBuys > 0 ? onOpenMarket("all") : onOpenTrack())}
        className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg transition active:scale-[0.99]"
      >
        {marketOpen && leftBuys > 0 ? "Открыть рынок" : "Смотреть трек"}
      </button>
    </div>
  );
}
