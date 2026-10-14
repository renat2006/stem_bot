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
        className="p-3"
        style={{
          backgroundImage: "radial-gradient(var(--ln) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      >
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gridTemplateAreas: template.gridAreas,
          }}
        >
          <div
            style={{ gridArea: "core" }}
            className="flex min-h-[96px] flex-col justify-between gap-1.5 rounded-xl bg-fg p-2.5 text-bg"
          >
            <span className="font-mono text-[9.5px] font-medium tracking-[0.08em] uppercase opacity-70">
              {template.objectName}
            </span>
            <div className="flex flex-col gap-1">
              {template.stats.map((stat) => (
                <span key={stat.id} className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                  <StatGlyph shape={stat.shape} color={stat.color} size={10} />
                  {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
                </span>
              ))}
            </div>
          </div>

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
                style={{
                  gridArea: slot.id,
                  boxShadow: card ? "0 1px 2px rgba(0,0,0,.05)" : "none",
                }}
                onClick={() => onSelectEmptySlot?.(slot.id)}
                className={`flex min-h-[82px] flex-col items-start gap-1 rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                  card
                    ? "border border-ln bg-sf text-fg"
                    : "border-[1.5px] border-dashed border-ac bg-transparent text-mu"
                }`}
              >
                <span className="font-mono text-[9.5px] font-medium tracking-[0.06em] uppercase text-mu">
                  {slot.label}
                </span>
                <span className="text-[12.5px] leading-tight font-medium">
                  {card ? card.name : availOnMarket > 0 ? `пусто · ${availOnMarket} на рынке` : "пусто"}
                </span>
                {card && <StatDeltaList stats={template.stats} deltas={card.stats} />}
              </button>
            );
          })}
        </div>

        {activePerk && (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-ln bg-sf px-2.5 py-2">
            <span className="h-3 w-3 shrink-0 rotate-45 border-2 border-ac" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-fg">{activePerk.name}</span>
              <span className="text-xs text-mu">{activePerk.effectText}</span>
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
