import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Shop } from "../../../widgets/shop/index.js";
import { SlotBuild } from "../../../widgets/slot-build/index.js";
import { TeamSummary } from "../../../widgets/team-summary/index.js";

interface TeamDashboardPageProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  run: RunAction;
}

export function TeamDashboardPage({ snapshot, team, run }: TeamDashboardPageProps) {
  const { template, gameState } = snapshot;
  return (
    <div className="space-y-4">
      <TeamSummary team={team} template={template} />
      <SlotBuild team={team} template={template} />
      <Shop
        team={team}
        template={template}
        currentDay={gameState.currentDay}
        isOpen={gameState.purchasePhaseActive}
        run={run}
      />
    </div>
  );
}
