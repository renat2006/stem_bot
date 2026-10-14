import type { GameTemplate } from "@stem/shared";
import { useState } from "react";
import type { TeamWithStats } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, ModuleCard } from "../../../shared/ui/index.js";
import { rewardTeams } from "../api/manage-team-api.js";

const POINTS_PER_CRITERION = 2;

interface RewardPanelProps {
  teams: TeamWithStats[];
  template: GameTemplate;
  run: RunAction;
}

export function RewardPanel({ teams, template, run }: RewardPanelProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<string[]>([]);
  const [extra, setExtra] = useState(0);

  const amount = criteria.length * POINTS_PER_CRITERION + extra;
  const allSelected = teams.length > 0 && selectedTeams.length === teams.length;
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const reason = criteria.length > 0 ? criteria.join("; ") : extra >= 0 ? "Бонус ведущего" : "Корректировка";

  const submit = () =>
    run(async () => {
      const result = await rewardTeams(selectedTeams, amount, reason);
      setCriteria([]);
      setExtra(0);
      return result;
    });

  return (
    <ModuleCard
      title="Начисление за учебный блок"
      subtitle={`по ${POINTS_PER_CRITERION} ${template.currencyName} за критерий`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedTeams(allSelected ? [] : teams.map((t) => t.id))}
            className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold ${
              allSelected ? "border-ac bg-ac/15 text-fg" : "border-ln bg-sf text-mu"
            }`}
          >
            Все команды
          </button>
          {teams.map((team) => {
            const active = selectedTeams.includes(team.id);
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeams((list) => toggle(list, team.id))}
                className={`min-h-[36px] rounded-lg border px-3 text-xs font-medium ${
                  active ? "border-ac bg-ac/15 text-fg" : "border-ln bg-sf text-mu"
                }`}
              >
                {team.name}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {template.rewardReasons.map((item) => {
            const active = criteria.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCriteria((list) => toggle(list, item))}
                className={`flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border px-3 text-left text-[13px] ${
                  active ? "border-ac bg-ac/10 text-fg" : "border-ln bg-sf2 text-fg"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                    active ? "border-ac bg-ac text-acfg" : "border-ln"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
                <span className="flex-1">{item}</span>
                <span className="font-mono text-xs font-semibold text-pos">+{POINTS_PER_CRITERION}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-mu">Доп. бонус или штраф</span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" onClick={() => setExtra((v) => v - 1)}>
              −
            </Button>
            <span className="w-10 text-center font-mono text-sm font-semibold text-fg">
              {extra > 0 ? `+${extra}` : extra}
            </span>
            <Button variant="ghost" onClick={() => setExtra((v) => v + 1)}>
              +
            </Button>
          </div>
        </div>

        <Button
          className="w-full"
          disabled={selectedTeams.length === 0 || amount === 0}
          onClick={() => void submit()}
        >
          {selectedTeams.length === 0
            ? "Выберите команды"
            : `${amount > 0 ? "Начислить" : "Списать"} ${Math.abs(amount)} ${template.currencyName} · ${selectedTeams.length} ком.`}
        </Button>
      </div>
    </ModuleCard>
  );
}
