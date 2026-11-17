import type { GameTemplate } from "@stem/shared";
import { BookOpen, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { saveDayBriefing } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { ModuleCard } from "../../../shared/ui/index.js";

export function BriefingEditor({
  template,
  currentDay,
  run,
}: {
  template: GameTemplate;
  currentDay: number;
  run: RunAction;
}) {
  const existing =
    template.dayBriefings.find((b) => b.day === currentDay) ?? template.dayBriefings.find((b) => b.day === 0);

  const [title, setTitle] = useState(existing?.title ?? `День ${currentDay}`);
  const [story, setStory] = useState(existing?.story ?? "");
  const [challengeTitle, setChallengeTitle] = useState(existing?.challengeTitle ?? "");

  useEffect(() => {
    const next =
      template.dayBriefings.find((b) => b.day === currentDay) ??
      template.dayBriefings.find((b) => b.day === 0);
    setTitle(next?.title ?? `День ${currentDay}`);
    setStory(next?.story ?? "");
    setChallengeTitle(next?.challengeTitle ?? "");
  }, [template.dayBriefings, currentDay]);

  const valid = title.trim().length >= 2 && story.trim().length >= 8;

  return (
    <ModuleCard
      title={`Сюжетный загон · День ${currentDay}`}
      subtitle="История и инженерный вызов дня для команд"
    >
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок сводки дня"
          aria-label="Заголовок сводки дня"
          className="h-11 w-full rounded-xl border border-ln bg-sf2 px-3.5 text-sm font-medium text-fg focus:border-ac focus:outline-none"
        />
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={3}
          placeholder="Короткая сюжетная сводка (2–4 предложения)…"
          aria-label="Текст сюжетной сводки"
          className="w-full rounded-xl border border-ln bg-sf2 p-3 text-sm leading-relaxed text-fg focus:border-ac focus:outline-none"
        />
        <input
          value={challengeTitle}
          onChange={(e) => setChallengeTitle(e.target.value)}
          placeholder="Тактическая задача раунда (необязательно)"
          aria-label="Тактическая задача раунда"
          className="h-10 w-full rounded-xl border border-ln bg-sf2 px-3.5 text-xs text-fg focus:border-ac focus:outline-none"
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              void run(() =>
                saveDayBriefing(
                  {
                    day: currentDay,
                    title: title.trim(),
                    story: story.trim(),
                    challengeTitle: challengeTitle.trim() || undefined,
                  },
                  false,
                ),
              )
            }
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ln bg-sf2 px-3 text-xs font-semibold text-fg disabled:opacity-45"
          >
            <BookOpen className="h-3.5 w-3.5 text-ac" />
            Сохранить сводку
          </button>

          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              void run(() =>
                saveDayBriefing(
                  {
                    day: currentDay,
                    title: title.trim(),
                    story: story.trim(),
                    challengeTitle: challengeTitle.trim() || undefined,
                  },
                  true,
                ),
              )
            }
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ac px-3 text-xs font-semibold text-acfg disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            Сохранить и разослать капитанам
          </button>
        </div>
      </div>
    </ModuleCard>
  );
}
