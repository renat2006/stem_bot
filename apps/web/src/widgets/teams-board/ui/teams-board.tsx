import type { GameTemplate } from "@stem/shared";
import type { TeamMemberInfo, TeamWithStats } from "../../../entities/game/index.js";
import { CreateTeamForm, TeamAdminActions } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BuySlots, Coin, formatStatValue, ModuleCard, StatGlyph } from "../../../shared/ui/index.js";

interface TeamsBoardProps {
  teams: TeamWithStats[];
  members: Record<string, TeamMemberInfo[]>;
  template: GameTemplate;
  purchaseLimit: number | null;
  run: RunAction;
}

export function TeamsBoard({ teams, members, template, purchaseLimit, run }: TeamsBoardProps) {
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);

  return (
    <ModuleCard title="Команды" subtitle={`${teams.length} в смене · код входа выдайте капитану`}>
      <div className="space-y-3">
        <CreateTeamForm run={run} />
        <ul className="space-y-3">
          {ranked.map((team, index) => (
            <li key={team.id} className="rounded-xl border border-ln bg-sf2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-fg">{team.name}</p>
                    <p className="text-xs text-mu">
                      клетка <span className="font-mono font-semibold text-fg">{team.trackPosition}</span>/
                      {template.trackMax} · шаг +{team.computedStats.step.total}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1.5 font-mono text-xl leading-none font-semibold text-fg">
                    {team.currency}
                    <Coin size={16} />
                  </span>
                  <BuySlots used={team.purchasesToday} limit={purchaseLimit} />
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-dashed border-ac/50 bg-sf px-3 py-2">
                <span className="text-xs text-mu">Код входа</span>
                <span className="select-all font-mono text-lg font-semibold tracking-[0.2em] text-fg">
                  {team.joinCode}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-sf px-3 py-2">
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

              <TeamAdminActions teamId={team.id} members={members[team.id] ?? []} run={run} />
            </li>
          ))}
        </ul>
      </div>
    </ModuleCard>
  );
}
