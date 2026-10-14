import type { GameSnapshot } from "../../../entities/game/index.js";
import { ShiftControls, TemplateSwitcher } from "../../../features/control-shift/index.js";
import { RewardPanel } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BalanceReport } from "../../../widgets/balance-report/index.js";
import { EventFeed } from "../../../widgets/event-feed/index.js";
import { TeamsBoard } from "../../../widgets/teams-board/index.js";

interface AdminConsolePageProps {
  snapshot: GameSnapshot;
  clockOffsetMs: number;
  run: RunAction;
}

export function AdminConsolePage({ snapshot, clockOffsetMs, run }: AdminConsolePageProps) {
  const { template, gameState } = snapshot;
  return (
    <div className="space-y-4">
      <ShiftControls
        gameState={gameState}
        totalDays={template.totalDays}
        clockOffsetMs={clockOffsetMs}
        run={run}
      />
      {snapshot.teams.length > 0 && <RewardPanel teams={snapshot.teams} template={template} run={run} />}
      <TeamsBoard
        teams={snapshot.teams}
        members={snapshot.members}
        template={template}
        purchaseLimit={gameState.dailyPurchaseLimit}
        run={run}
      />
      <EventFeed feed={snapshot.feed} teams={snapshot.teams} title="Журнал смены" />
      <BalanceReport report={snapshot.balanceReport} />
      <TemplateSwitcher templates={snapshot.availableTemplates} activeId={template.id} run={run} />
    </div>
  );
}
