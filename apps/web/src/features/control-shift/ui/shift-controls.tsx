import type { GameState, ShiftPhase } from "@stem/shared";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, ModuleCard } from "../../../shared/ui/index.js";
import { loadDemoMidgame, resetShift, updateGameState } from "../api/control-shift-api.js";

interface ShiftControlsProps {
  gameState: GameState;
  totalDays: number;
  run: RunAction;
}

const PHASES: Array<{ id: ShiftPhase; label: string }> = [
  { id: "scoring", label: "1. Начисление" },
  { id: "market", label: "2. Рынок" },
  { id: "turn", label: "3. Ход" },
  { id: "summary", label: "4. Итоги" },
];

export function ShiftControls({ gameState, totalDays, run }: ShiftControlsProps) {
  const days = Array.from({ length: totalDays }, (_, idx) => idx + 1);
  const currentPhase = gameState.currentPhase ?? (gameState.purchasePhaseActive ? "market" : "scoring");

  return (
    <ModuleCard title="Управление сменой и фазами">
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] font-medium uppercase text-mu">Текущая фаза раунда</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PHASES.map((phase) => {
              const active = currentPhase === phase.id;
              return (
                <Button
                  key={phase.id}
                  variant={active ? "primary" : "ghost"}
                  onClick={() => run(() => updateGameState({ currentPhase: phase.id }))}
                >
                  {phase.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ln pt-3">
          <span className="text-[13px] font-medium text-mu">День смены:</span>
          {days.map((day) => (
            <Button
              key={day}
              variant={gameState.currentDay === day ? "primary" : "ghost"}
              className="min-w-[40px]"
              onClick={() => run(() => updateGameState({ currentDay: day }))}
            >
              {day}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-ln pt-3">
          <Button
            variant="destructive"
            onClick={() => {
              localStorage.removeItem("konstrukt_onboarded");
              void run(() => resetShift());
            }}
          >
            Начать смену с нуля (День 1)
          </Button>
          <Button variant="accent" onClick={() => run(() => loadDemoMidgame())}>
            Загрузить демо (День 3)
          </Button>
        </div>
      </div>
    </ModuleCard>
  );
}
