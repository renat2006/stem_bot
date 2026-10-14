import type { TemplateSummary } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { ConfirmButton, ModuleCard } from "../../../shared/ui/index.js";
import { resetEvent } from "../api/control-shift-api.js";

interface TemplateSwitcherProps {
  templates: TemplateSummary[];
  activeId: string;
  run: RunAction;
}

export function TemplateSwitcher({ templates, activeId, run }: TemplateSwitcherProps) {
  return (
    <ModuleCard title="Сеттинг и перезапуск" subtitle="Перезапуск удаляет команды, участников и покупки">
      <div className="space-y-2">
        {templates.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-ln bg-sf2 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">
                {item.currencyIcon} {item.title}
              </p>
              <p className="truncate text-xs text-mu">{item.theme}</p>
            </div>
            <ConfirmButton
              variant={item.id === activeId ? "destructive" : "accent"}
              confirmLabel="Точно?"
              onConfirm={() => run(() => resetEvent(item.id, false))}
            >
              {item.id === activeId ? "Перезапуск" : "Запустить"}
            </ConfirmButton>
          </div>
        ))}
        <ConfirmButton
          variant="accent"
          className="w-full"
          confirmLabel="Точно? Текущие команды удалятся"
          onConfirm={() => run(() => resetEvent(activeId, true))}
        >
          Перезапуск с демо-командами
        </ConfirmButton>
      </div>
    </ModuleCard>
  );
}
