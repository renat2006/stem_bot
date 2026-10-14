import type { GameState, ShiftPhase } from "@stem/shared";
import { type RunAction, useCountdown } from "../../../shared/lib/index.js";
import { Button, ConfirmButton, ModuleCard } from "../../../shared/ui/index.js";
import { applyTurn, nextDay, setPhase, updatePurchaseLimit } from "../api/control-shift-api.js";

interface ShiftControlsProps {
  gameState: GameState;
  totalDays: number;
  clockOffsetMs: number;
  run: RunAction;
}

const PHASES: Array<{ id: ShiftPhase; label: string; hint: string }> = [
  { id: "scoring", label: "Начисление", hint: "Оцените учебный блок команд" },
  { id: "market", label: "Рынок", hint: "Команды покупают карты" },
  { id: "turn", label: "Ход", hint: "Примените шаг по треку" },
  { id: "summary", label: "Итоги", hint: "Рейтинг дня зафиксирован" },
];
const MARKET_MINUTES = [5, 10, 15, 30];

function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ShiftControls({ gameState, totalDays, clockOffsetMs, run }: ShiftControlsProps) {
  const seconds = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const current = PHASES.find((p) => p.id === gameState.currentPhase) ?? PHASES[0];
  const limit = gameState.dailyPurchaseLimit;

  return (
    <ModuleCard
      title={`День ${gameState.currentDay} из ${totalDays}`}
      subtitle={current ? `${current.label}: ${current.hint}` : undefined}
      badge={
        gameState.phaseEndsAt ? (
          <span className={`font-mono text-sm font-semibold ${seconds > 0 ? "text-fg" : "text-neg"}`}>
            {seconds > 0 ? formatTimer(seconds) : "время вышло"}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-sf2 p-1">
          {PHASES.map((phase) => (
            <button
              key={phase.id}
              type="button"
              onClick={() => run(() => setPhase(phase.id))}
              className={`min-h-[40px] rounded-[9px] text-xs font-medium ${
                gameState.currentPhase === phase.id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>

        {gameState.currentPhase === "scoring" && (
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-mu">Открыть рынок на:</span>
            <div className="grid grid-cols-5 gap-1.5">
              {MARKET_MINUTES.map((minutes) => (
                <Button key={minutes} variant="accent" onClick={() => run(() => setPhase("market", minutes))}>
                  {minutes} мин
                </Button>
              ))}
              <Button variant="ghost" onClick={() => run(() => setPhase("market"))}>
                ∞
              </Button>
            </div>
          </div>
        )}

        {gameState.currentPhase === "market" && (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="ghost"
              onClick={() => run(() => setPhase("market", Math.ceil(seconds / 60) + 5))}
            >
              Продлить на 5 мин
            </Button>
            <Button onClick={() => run(() => setPhase("turn"))}>Закрыть рынок → ход</Button>
          </div>
        )}

        {gameState.currentPhase === "turn" && (
          <ConfirmButton
            variant="primary"
            className="w-full"
            confirmLabel="Подтвердить: сдвинуть все команды"
            onConfirm={() => run(() => applyTurn())}
          >
            Применить шаг по треку ко всем командам
          </ConfirmButton>
        )}

        {gameState.currentPhase === "summary" && (
          <ConfirmButton
            variant="primary"
            className="w-full"
            confirmLabel={`Подтвердить переход к дню ${gameState.currentDay + 1}`}
            onConfirm={() => run(() => nextDay())}
          >
            {gameState.currentDay < totalDays ? `Начать день ${gameState.currentDay + 1}` : "Смена завершена"}
          </ConfirmButton>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-ln pt-3">
          <span className="text-[13px] text-mu">Лимит покупок за точку</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              disabled={limit === 0}
              onClick={() => run(() => updatePurchaseLimit(Math.max(0, (limit ?? 3) - 1)))}
            >
              −
            </Button>
            <span className="w-10 text-center font-mono text-sm font-semibold text-fg">{limit ?? "∞"}</span>
            <Button
              variant="ghost"
              onClick={() => run(() => updatePurchaseLimit(limit === null ? null : limit + 1))}
            >
              +
            </Button>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
