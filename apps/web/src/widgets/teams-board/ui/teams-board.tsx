import type { GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { TeamAdminActions } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BuySlots, Coin, formatStatValue, ModuleCard, StatGlyph } from "../../../shared/ui/index.js";

interface TeamsBoardProps {
  teams: TeamWithStats[];
  template: GameTemplate;
  run: RunAction;
}

export function TeamsBoard({ teams, template, run }: TeamsBoardProps) {
  return (
    <ModuleCard title="Команды и начисление" subtitle={`${teams.length} команд в смене`}>
      <ul className="space-y-3">
        {teams.map((team) => (
          <li key={team.id} className="rounded-xl border border-ln bg-sf2 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
                  {team.monogram}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-fg">{team.name}</p>
                  <p className="text-xs text-mu">
                    капитан @{team.captainUsername} · {template.trackName}:{" "}
                    <span className="font-mono font-semibold text-fg">
                      {team.trackPosition}/{template.trackMax}
                    </span>{" "}
                    (шаг +{team.computedStats.step.total})
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1.5 font-mono text-xl leading-none font-semibold text-fg">
                  {team.currency}
                  <Coin size={16} />
                </span>
                <BuySlots used={team.purchasesToday} limit={template.dailyPurchaseLimit} />
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-lg bg-sf px-3 py-2">
              {template.stats.map((stat) => (
                <span key={stat.id} className="flex items-center gap-1.5 text-xs text-mu">
                  <StatGlyph shape={stat.shape} color={stat.color} size={10} />
                  <span>{stat.label}:</span>
                  <span className="font-mono font-semibold text-fg">
                    {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
                  </span>
                </span>
              ))}
            </div>

            <TeamAdminActions
              teamId={team.id}
              currencyName={template.currencyName}
              rewardReasons={template.rewardReasons}
              run={run}
            />
          </li>
        ))}
      </ul>
    </ModuleCard>
  );
}
