import type { RunAction } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { moveTeamOnTrack, rewardTeam } from "../api/manage-team-api.js";

interface TeamAdminActionsProps {
  teamId: string;
  currencyName: string;
  run: RunAction;
}

export function TeamAdminActions({ teamId, currencyName, run }: TeamAdminActionsProps) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {[1, 3].map((amount) => (
        <Button key={amount} variant="positive" onClick={() => run(() => rewardTeam(teamId, amount))}>
          +{amount} {currencyName}
        </Button>
      ))}
      <Button variant="destructive" onClick={() => run(() => rewardTeam(teamId, -1))}>
        −1 {currencyName}
      </Button>
      <Button variant="accent" onClick={() => run(() => moveTeamOnTrack(teamId, 1))}>
        +1 шаг трека
      </Button>
      <Button variant="ghost" onClick={() => run(() => moveTeamOnTrack(teamId, -1))}>
        −1 шаг трека
      </Button>
    </div>
  );
}
