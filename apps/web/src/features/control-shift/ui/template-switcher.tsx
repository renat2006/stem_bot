import type { TemplateSummary } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Badge, ModuleCard } from "../../../shared/ui/index.js";
import { switchTemplate } from "../api/control-shift-api.js";

interface TemplateSwitcherProps {
  templates: TemplateSummary[];
  activeId: string;
  run: RunAction;
}

export function TemplateSwitcher({ templates, activeId, run }: TemplateSwitcherProps) {
  return (
    <ModuleCard title="Сеттинг события (Конструктор)">
      <div className="grid gap-2">
        {templates.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={active}
              onClick={() => run(() => switchTemplate(item.id))}
              className={`flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                active ? "border-ac bg-ac/15" : "border-ln bg-sf2"
              }`}
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-fg">
                  {item.currencyIcon} {item.title}
                </p>
                <p className="mt-0.5 text-xs text-mu">{item.theme}</p>
              </div>
              <Badge tone={active ? "accent" : "neutral"}>{active ? "Активен" : "Выбрать"}</Badge>
            </button>
          );
        })}
      </div>
    </ModuleCard>
  );
}
