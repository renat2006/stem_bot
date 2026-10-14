import type { GameState } from "@stem/shared";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, ModuleCard } from "../../../shared/ui/index.js";
import { updateGameState } from "../api/control-shift-api.js";

interface ShiftControlsProps {
  gameState: GameState;
  totalDays: number;
  run: RunAction;
}

export function ShiftControls({ gameState, totalDays, run }: ShiftControlsProps) {
  const shopOpen = gameState.purchasePhaseActive;
  const days = Array.from({ length: totalDays }, (_, idx) => idx + 1);

  return (
    <ModuleCard
      title="Управление сменой и рынком"
      badge={
        <Button
          variant={shopOpen ? "destructive" : "positive"}
          onClick={() => run(() => updateGameState({ purchasePhaseActive: !shopOpen }))}
        >
          {shopOpen ? "Закрыть рынок" : "Открыть рынок"}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-mu">Активный день / окно:</span>
        {days.map((day) => (
          <Button
            key={day}
            variant={gameState.currentDay === day ? "primary" : "ghost"}
            className="min-w-[42px]"
            onClick={() => run(() => updateGameState({ currentDay: day }))}
          >
            {day}
          </Button>
        ))}
      </div>
    </ModuleCard>
  );
}
