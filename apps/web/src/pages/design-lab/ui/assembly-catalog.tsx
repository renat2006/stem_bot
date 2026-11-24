import { NEUROFAUNA_TEMPLATE, ROVER_SPRINT_TEMPLATE } from "@stem/shared";
import { useState } from "react";
import { AssemblyStage, PartSticker } from "../../../entities/assembly/index.js";
import "./assembly-catalog.css";

export function AssemblyCatalog() {
  const [template, setTemplate] = useState(NEUROFAUNA_TEMPLATE);
  const [equipped, setEquipped] = useState<Record<string, string | null>>({});
  const [slot, setSlot] = useState(template.slots[0]?.id ?? "");
  return (
    <main className="kitcatalog">
      <header>
        <a href="?design=1">Полевой атлас</a>
        <span>Мастерская</span>
      </header>
      <h1>Стол сборки</h1>
      <nav aria-label="Модель">
        {[NEUROFAUNA_TEMPLATE, ROVER_SPRINT_TEMPLATE].map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={t.id === template.id}
            onClick={() => {
              setTemplate(t);
              setEquipped({});
              setSlot(t.slots[0]?.id ?? "");
            }}
          >
            {t.objectName}
          </button>
        ))}
      </nav>
      <div className="kitgrid">
        <section>
          <AssemblyStage
            template={template}
            equipped={equipped}
            interactive
            onSlotTap={setSlot}
            selectedSlotId={slot}
          />
          <p>Базовая форма видна сразу. Выберите деталь, чтобы изменить сборку.</p>
        </section>
        <section>
          <label>
            Часть сборки
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {template.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="kitparts">
            {template.cards
              .filter((c) => c.slotId === slot)
              .map((c) => (
                <button
                  type="button"
                  aria-pressed={equipped[slot] === c.id}
                  key={c.id}
                  onClick={() => setEquipped({ ...equipped, [slot]: c.id })}
                >
                  <PartSticker template={template} card={c} thumbnail />
                  {c.name}
                </button>
              ))}
          </div>
          <button
            type="button"
            disabled={!equipped[slot]}
            onClick={() => setEquipped({ ...equipped, [slot]: null })}
          >
            Снять деталь
          </button>
        </section>
      </div>
    </main>
  );
}
