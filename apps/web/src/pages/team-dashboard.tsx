import type { GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../shared/index.js";

interface Props {
  team: TeamWithStats;
  template: GameTemplate;
  onBuyCard: (cardId: string) => void;
  onBuyPerk: (perkId: string) => void;
  currentDay: number;
  purchasePhaseActive: boolean;
}

export function TeamDashboardPage({
  team,
  template,
  onBuyCard,
  onBuyPerk,
  currentDay,
  purchasePhaseActive,
}: Props) {
  const cardMap = new Map(template.cards.map((c) => [c.id, c]));
  const availableCards = template.cards.filter((c) => c.dayAvailable <= currentDay);
  const availablePerks = template.perks.filter((p) => p.dayAvailable <= currentDay);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Команда · @{team.captainUsername}</p>
            <h2 className="text-lg font-bold text-white">{team.name}</h2>
          </div>
          <div className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-right">
            <p className="text-xs text-emerald-300">{template.currencyName}</p>
            <p className="text-lg font-bold text-emerald-400">
              {template.currencyIcon} {team.currency}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{template.trackName}</span>
            <span>
              {team.trackPosition} / {template.trackMax}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, (team.trackPosition / template.trackMax) * 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {template.stats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-center"
            >
              <div className="text-xs text-slate-400">
                {stat.icon} {stat.label}
              </div>
              <div className="mt-0.5 text-lg font-bold text-white">
                {team.computedStats.total[stat.id] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Сборка по слотам</h3>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {template.slots.map((slot) => {
            const equippedId = team.equippedCards[slot.id];
            const card = equippedId ? cardMap.get(equippedId) : undefined;
            return (
              <div key={slot.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">{slot.label}</p>
                <p className="mt-1 text-sm font-medium text-white">{card ? card.name : "Пусто"}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Магазин компонентов (День 1–{currentDay})</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              purchasePhaseActive ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {purchasePhaseActive ? "Открыт" : "Закрыт"}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {availableCards.map((card) => {
            const slotLabel = template.slots.find((s) => s.id === card.slotId)?.label ?? card.slotId;
            const isEquipped = team.equippedCards[card.slotId] === card.id;
            return (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{card.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {slotLabel}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-2 text-xs text-slate-400">
                    {template.stats.map((st) => {
                      const val = card.stats[st.id] ?? 0;
                      if (val === 0) return null;
                      return (
                        <span key={st.id} className={val > 0 ? "text-emerald-400" : "text-rose-400"}>
                          {st.icon} {val > 0 ? `+${val}` : val}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button
                  disabled={!purchasePhaseActive || isEquipped || team.currency < card.price}
                  onClick={() => onBuyCard(card.id)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {isEquipped ? "Установлено" : `${card.price} ${template.currencyIcon}`}
                </button>
              </div>
            );
          })}
        </div>

        {availablePerks.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Специальные свойства
            </h4>
            <div className="mt-2 space-y-2">
              {availablePerks.map((perk) => {
                const isActive = team.activePerkId === perk.id;
                return (
                  <div
                    key={perk.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="pr-3">
                      <p className="text-sm font-medium text-white">{perk.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{perk.effectText}</p>
                    </div>
                    <button
                      disabled={!purchasePhaseActive || isActive || team.currency < perk.price}
                      onClick={() => onBuyPerk(perk.id)}
                      className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {isActive ? "Активно" : `${perk.price} ${template.currencyIcon}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
