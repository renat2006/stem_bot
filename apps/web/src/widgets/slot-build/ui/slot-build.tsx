import type { GameTemplate, Team } from "@stem/shared";
import { Section } from "../../../shared/ui/index.js";

interface SlotBuildProps {
  team: Team;
  template: GameTemplate;
}

export function SlotBuild({ team, template }: SlotBuildProps) {
  const cardById = new Map(template.cards.map((card) => [card.id, card]));
  return (
    <Section title="Сборка по слотам">
      <div className="grid grid-cols-2 gap-2">
        {template.slots.map((slot) => {
          const equippedId = team.equippedCards[slot.id];
          const card = equippedId ? cardById.get(equippedId) : undefined;
          return (
            <div key={slot.id} className="rounded-xl bg-secondary p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-hint">{slot.label}</p>
              <p className="mt-1 text-sm font-medium text-text">{card ? card.name : "Пусто"}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
