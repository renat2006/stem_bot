import type { GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { StatGrid, TrackProgress } from "../../../entities/team/index.js";

interface TeamSummaryProps {
  team: TeamWithStats;
  template: GameTemplate;
}

export function TeamSummary({ team, template }: TeamSummaryProps) {
  return (
    <section className="space-y-3 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-hint">Команда · @{team.captainUsername}</p>
          <h2 className="text-lg font-bold text-text">{team.name}</h2>
        </div>
        <div className="rounded-xl bg-positive/15 px-3 py-1.5 text-right">
          <p className="text-xs text-positive">{template.currencyName}</p>
          <p className="text-lg font-bold text-positive">
            {template.currencyIcon} {team.currency}
          </p>
        </div>
      </div>
      <TrackProgress label={template.trackName} position={team.trackPosition} max={template.trackMax} />
      <StatGrid stats={template.stats} values={team.computedStats.total} />
    </section>
  );
}
