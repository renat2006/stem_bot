import type { GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { TeamAdminActions } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Section } from "../../../shared/ui/index.js";

interface TeamsBoardProps {
  teams: TeamWithStats[];
  template: GameTemplate;
  run: RunAction;
}

export function TeamsBoard({ teams, template, run }: TeamsBoardProps) {
  return (
    <Section title="Управление командами">
      <ul className="space-y-3">
        {teams.map((team) => (
          <li key={team.id} className="rounded-xl bg-secondary p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">{team.name}</p>
                <p className="text-xs text-hint">
                  {template.trackName}: {team.trackPosition}/{template.trackMax} · Покупок:{" "}
                  {team.purchasesToday}
                </p>
              </div>
              <span className="text-sm font-bold text-positive">
                {template.currencyIcon} {team.currency}
              </span>
            </div>
            <TeamAdminActions teamId={team.id} currencyName={template.currencyName} run={run} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
