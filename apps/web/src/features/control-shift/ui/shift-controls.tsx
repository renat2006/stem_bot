import type { GameState } from "@stem/shared";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, Section } from "../../../shared/ui/index.js";
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
    <Section
      title="Управление сменой и магазином"
      aside={
        <Button
          variant={shopOpen ? "destructive" : "positive"}
          onClick={() => run(() => updateGameState({ purchasePhaseActive: !shopOpen }))}
        >
          {shopOpen ? "Закрыть магазин" : "Открыть магазин"}
        </Button>
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-hint">День смены:</span>
        {days.map((day) => (
          <Button
            key={day}
            variant={gameState.currentDay === day ? "primary" : "ghost"}
            className="h-8 w-8 px-0"
            onClick={() => run(() => updateGameState({ currentDay: day }))}
          >
            {day}
          </Button>
        ))}
      </div>
    </Section>
  );
}
