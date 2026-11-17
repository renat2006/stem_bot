import type { GameTemplate, LoreBriefing } from "@stem/shared";
import { Compass, Sparkles } from "lucide-react";
import { useState } from "react";
import { PackIllustration } from "../../../entities/assembly/index.js";
import { BottomSheet } from "../../../shared/ui/index.js";

export function LoreBriefingSheet({
  open,
  onClose,
  template,
  currentDay,
}: {
  open: boolean;
  onClose: () => void;
  template: GameTemplate;
  currentDay: number;
}) {
  const available = template.dayBriefings.filter((b) => b.day <= currentDay);
  const defaultBriefing =
    available.find((b) => b.day === currentDay) ?? available.at(-1) ?? template.dayBriefings[0];
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const active: LoreBriefing | undefined =
    (selectedDay !== null ? available.find((b) => b.day === selectedDay) : undefined) ?? defaultBriefing;

  return (
    <BottomSheet open={open} onClose={onClose} title={active?.title ?? "Сводка экспедиции"}>
      {active ? (
        <div className="space-y-4">
          <PackIllustration
            template={template}
            kind="story"
            label={active.title}
            className="h-48 w-full rounded-2xl border border-ln object-cover"
          />

          {available.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {available.map((item) => {
                const isSelected = item.day === active.day;
                return (
                  <button
                    key={item.day}
                    type="button"
                    onClick={() => setSelectedDay(item.day)}
                    className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium ${
                      isSelected ? "border-ac bg-ac text-acfg" : "border-ln bg-sf text-mu"
                    }`}
                  >
                    {item.day === 0 ? "Пролог" : `День ${item.day}`}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-ac">
              <Sparkles className="h-3.5 w-3.5" />
              {active.day === 0 ? "Предыстория смены" : `Сводка · День ${active.day}`}
            </span>
            <h3 className="text-xl leading-tight font-semibold text-fg">{active.title}</h3>
            <p className="text-sm leading-relaxed text-mu">{active.story}</p>
          </div>

          {active.challengeTitle && (
            <div className="flex items-start gap-2.5 rounded-xl border border-ac/35 bg-ac/10 p-3.5">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-ac" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-fg">Задача на раунд</p>
                <p className="text-xs leading-relaxed text-mu">{active.challengeTitle}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg"
          >
            Принято
          </button>
        </div>
      ) : (
        <p className="text-sm text-mu">Сюжетные сводки пока не опубликованы.</p>
      )}
    </BottomSheet>
  );
}
