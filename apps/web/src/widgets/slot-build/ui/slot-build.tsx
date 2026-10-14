import type { GameState, GameTemplate } from "@stem/shared";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { formatStatValue, ModuleCard, StatGlyph } from "../../../shared/ui/index.js";

interface SlotBuildProps {
  team: TeamWithStats;
  template: GameTemplate;
  gameState?: GameState;
  onSelectEmptySlot?: (slotId: string) => void;
  onHelp?: () => void;
}

export function SlotBuild({ team, template, gameState, onSelectEmptySlot, onHelp }: SlotBuildProps) {
  const cardById = new Map(template.cards.map((card) => [card.id, card]));
  const currentDay = gameState?.currentDay ?? 1;
  const stockLeft = gameState?.cardStockLeft ?? {};

  const equippedCount = template.slots.filter((s) => Boolean(team.equippedCards[s.id])).length;
  const buildLine = `${template.objectName.toLowerCase()} · ${equippedCount} из ${template.slots.length}`;
  const activePerk = template.perks.find((p) => p.id === team.activePerkId);

  return (
    <ModuleCard title="Сборка" subtitle={buildLine} onHelp={onHelp} noPadding>
      <div
        className="space-y-2.5 p-3.5"
        style={{
          backgroundImage: "radial-gradient(var(--ln) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fg px-3.5 py-2.5 text-bg">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase opacity-80">
              {template.objectName}
            </span>
            <span className="rounded bg-bg/15 px-2 py-0.5 font-mono text-xs font-semibold">
              шаг {team.computedStats.step.total}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {template.stats.map((stat) => (
              <span
                key={stat.id}
                title={stat.label}
                className="flex items-center gap-1.5 font-mono text-sm font-semibold"
              >
                <StatGlyph shape={stat.shape} color={stat.color} size={11} />
                {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {template.slots.map((slot) => {
            const equippedId = team.equippedCards[slot.id];
            const card = equippedId ? cardById.get(equippedId) : undefined;
            const availOnMarket = template.cards.filter(
              (c) => c.slotId === slot.id && c.dayAvailable <= currentDay && (stockLeft[c.id] ?? c.stock) > 0,
            ).length;

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSelectEmptySlot?.(slot.id)}
                style={{
                  boxShadow: card ? "0 1px 2px rgba(0,0,0,.05)" : "none",
                }}
                className={`flex min-h-[86px] flex-col justify-between gap-1.5 rounded-xl p-3 text-left transition active:scale-[0.98] ${
                  card
                    ? "border border-ln bg-sf text-fg"
                    : "border-[1.5px] border-dashed border-ac bg-sf/50 text-mu"
                }`}
              >
                <div className="space-y-1">
                  <span className="block font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-mu">
                    {slot.label}
                  </span>
                  <span className="block text-[13.5px] leading-snug font-semibold">
                    {card ? card.name : availOnMarket > 0 ? `Пусто · ${availOnMarket} в магазине` : "Пусто"}
                  </span>
                </div>
                {card && <StatDeltaList stats={template.stats} deltas={card.stats} />}
              </button>
            );
          })}
        </div>

        {activePerk && (
          <div className="flex items-center gap-3 rounded-xl border border-ln bg-sf p-3">
            <span className="h-3.5 w-3.5 shrink-0 rotate-45 border-2 border-ac" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold text-fg">{activePerk.name}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                    team.computedStats.perkConditionMet ? "bg-pos/15 text-pos" : "bg-sf2 text-mu"
                  }`}
                >
                  {team.computedStats.perkConditionMet ? "активно" : "условие не выполнено"}
                </span>
              </div>
              <span className="text-xs leading-snug text-mu">{activePerk.effectText}</span>
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
