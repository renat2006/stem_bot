import { useState } from "react";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { moveTeamOnTrack, rewardTeam } from "../api/manage-team-api.js";

interface TeamAdminActionsProps {
  teamId: string;
  currencyName: string;
  rewardReasons?: string[];
  run: RunAction;
}

export function TeamAdminActions({ teamId, currencyName, rewardReasons = [], run }: TeamAdminActionsProps) {
  const [showCriteria, setShowCriteria] = useState(false);

  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="positive" onClick={() => run(() => rewardTeam(teamId, 2))}>
          +2 {currencyName}
        </Button>
        <Button variant="positive" onClick={() => run(() => rewardTeam(teamId, 5))}>
          +5 {currencyName}
        </Button>
        <Button variant="destructive" onClick={() => run(() => rewardTeam(teamId, -2))}>
          −2 {currencyName}
        </Button>
        <Button variant="accent" onClick={() => run(() => moveTeamOnTrack(teamId, 1))}>
          +1 шаг
        </Button>
        <Button variant="ghost" onClick={() => run(() => moveTeamOnTrack(teamId, -1))}>
          −1 шаг
        </Button>
        {rewardReasons.length > 0 && (
          <Button variant="ghost" onClick={() => setShowCriteria((v) => !v)}>
            {showCriteria ? "Скрыть критерии" : "По критериям"}
          </Button>
        )}
      </div>

      {showCriteria && rewardReasons.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-ln bg-sf p-2.5">
          <p className="font-mono text-[11px] font-medium uppercase text-mu">
            Оценка учебного блока (+2 {currencyName})
          </p>
          {rewardReasons.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => run(() => rewardTeam(teamId, 2))}
              className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg bg-sf2 px-3 py-2 text-left text-xs font-medium text-fg transition active:scale-[0.99]"
            >
              <span>{reason}</span>
              <span className="shrink-0 font-mono font-semibold text-pos">+2</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
