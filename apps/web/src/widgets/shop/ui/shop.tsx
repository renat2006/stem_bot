import type { GameTemplate } from "@stem/shared";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { PurchaseButton } from "../../../features/purchase/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Badge, Section } from "../../../shared/ui/index.js";

interface ShopProps {
  team: TeamWithStats;
  template: GameTemplate;
  currentDay: number;
  isOpen: boolean;
  run: RunAction;
}

export function Shop({ team, template, currentDay, isOpen, run }: ShopProps) {
  const slotLabel = new Map(template.slots.map((slot) => [slot.id, slot.label]));
  const cards = template.cards.filter((card) => card.dayAvailable <= currentDay);
  const perks = template.perks.filter((perk) => perk.dayAvailable <= currentDay);
  const price = (value: number) => `${value} ${template.currencyIcon}`;

  return (
    <Section
      title={`Магазин компонентов (День 1–${currentDay})`}
      aside={<Badge tone={isOpen ? "positive" : "destructive"}>{isOpen ? "Открыт" : "Закрыт"}</Badge>}
    >
      <ul className="space-y-2">
        {cards.map((card) => {
          const equipped = team.equippedCards[card.slotId] === card.id;
          return (
            <li key={card.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{card.name}</span>
                  <Badge>{slotLabel.get(card.slotId) ?? card.slotId}</Badge>
                </div>
                <StatDeltaList stats={template.stats} deltas={card.stats} />
              </div>
              <PurchaseButton
                kind="card"
                teamId={team.id}
                itemId={card.id}
                label={equipped ? "Установлено" : price(card.price)}
                disabled={!isOpen || equipped || team.currency < card.price}
                run={run}
              />
            </li>
          );
        })}
      </ul>

      {perks.length > 0 && (
        <div className="mt-4 border-t border-separator pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-hint">Специальные свойства</h4>
          <ul className="mt-2 space-y-2">
            {perks.map((perk) => {
              const active = team.activePerkId === perk.id;
              return (
                <li
                  key={perk.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{perk.name}</p>
                    <p className="mt-0.5 text-xs text-hint">{perk.effectText}</p>
                  </div>
                  <PurchaseButton
                    kind="perk"
                    teamId={team.id}
                    itemId={perk.id}
                    label={active ? "Активно" : price(perk.price)}
                    disabled={!isOpen || active || team.currency < perk.price}
                    run={run}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}
