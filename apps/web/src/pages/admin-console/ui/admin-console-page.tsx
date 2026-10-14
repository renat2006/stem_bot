import type { GameSnapshot } from "../../../entities/game/index.js";
import { ShiftControls, TemplateSwitcher } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BalanceReport } from "../../../widgets/balance-report/index.js";
import { TeamsBoard } from "../../../widgets/teams-board/index.js";

interface AdminConsolePageProps {
  snapshot: GameSnapshot;
  run: RunAction;
}

export function AdminConsolePage({ snapshot, run }: AdminConsolePageProps) {
  const { template, gameState } = snapshot;
  return (
    <div className="space-y-4">
      <TemplateSwitcher templates={snapshot.availableTemplates} activeId={template.id} run={run} />
      <ShiftControls gameState={gameState} totalDays={template.totalDays} run={run} />
      <TeamsBoard teams={snapshot.teams} template={template} run={run} />
      <BalanceReport report={snapshot.balanceReport} />
    </div>
  );
}
