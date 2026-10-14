import type { TemplateSummary } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Badge, Section } from "../../../shared/ui/index.js";
import { switchTemplate } from "../api/control-shift-api.js";

interface TemplateSwitcherProps {
  templates: TemplateSummary[];
  activeId: string;
  run: RunAction;
}

export function TemplateSwitcher({ templates, activeId, run }: TemplateSwitcherProps) {
  return (
    <Section title="Игровой сеттинг">
      <div className="grid gap-2">
        {templates.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={active}
              onClick={() => run(() => switchTemplate(item.id))}
              className={`flex items-center justify-between rounded-xl p-3 text-left transition ${
                active ? "bg-accent/15 ring-1 ring-accent" : "bg-secondary"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-text">
                  {item.currencyIcon} {item.title}
                </p>
                <p className="text-xs text-hint">{item.theme}</p>
              </div>
              <Badge tone={active ? "accent" : "neutral"}>{active ? "Активен" : "Выбрать"}</Badge>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
