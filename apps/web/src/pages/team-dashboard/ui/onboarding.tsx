import type { GameTemplate } from "@stem/shared";
import { useState } from "react";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { getThresholdsForStat, StatMeter, StepBlocks } from "../../../entities/team/index.js";
import { Coin, formatStatValue, StatGlyph } from "../../../shared/ui/index.js";

const STEPS = 3;
const STEP_IDS = ["earn", "build", "step"] as const;

export function Onboarding({
  template,
  team,
  onDone,
}: {
  template: GameTemplate;
  team: TeamWithStats;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const sampleCard = template.cards[0];
  const sampleStat = template.stats[0];
  const titles = [
    `Учитесь — получайте ${template.currencyName}`,
    "Покупайте карты в слоты",
    "Пороги дают шаги",
  ];
  const texts = [
    `После учебного блока ведущий отмечает критерии работы команды. Каждый даёт 2 ${template.currencyName}.`,
    "В каждом слоте одна карта. Новая карта заменяет старую: склада нет, думайте, что вытесняете. Покупает капитан, остальные предлагают.",
    "Когда характеристика дотягивает до отмеченной клетки, вы получаете бонус к шагу. Кто дальше на треке, тот выше в рейтинге.",
  ];

  return (
    <div className="space-y-4 pt-1">
      <div className="flex gap-1.5">
        {STEP_IDS.map((id, i) => (
          <div key={id} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ac" : "bg-sf2"}`} />
        ))}
      </div>

      <div
        className="flex min-h-[240px] items-center justify-center rounded-2xl border border-ln bg-sf p-5"
        style={{
          backgroundImage: "radial-gradient(var(--ln) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {step === 0 && (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col gap-2">
              {template.rewardReasons.slice(0, 5).map((reason) => (
                <div key={reason} className="flex items-center gap-2.5 rounded-lg bg-bg px-3 py-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-ac text-[11px] font-bold text-acfg">
                    ✓
                  </span>
                  <span className="flex-1 text-[13px] text-fg">{reason}</span>
                  <span className="font-mono text-xs font-semibold text-fg">+2</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-3xl leading-none font-semibold text-fg">
                +{template.rewardReasons.slice(0, 5).length * 2}
              </span>
              <Coin size={20} />
            </div>
          </div>
        )}
        {step === 1 && sampleCard && (
          <div className="flex items-center gap-3.5">
            <div className="flex w-36 -rotate-3 flex-col gap-1.5 rounded-xl border border-ln bg-bg p-3 shadow-md">
              <span className="font-mono text-[11px] tracking-[0.05em] uppercase text-mu">
                {template.slots.find((s) => s.id === sampleCard.slotId)?.label ?? sampleCard.slotId}
              </span>
              <span className="text-sm leading-snug font-semibold text-fg">{sampleCard.name}</span>
              <StatDeltaList stats={template.stats} deltas={sampleCard.stats} />
            </div>
            <span className="font-mono text-lg text-ac">→</span>
            <div className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ac p-2.5 text-center">
              <span className="font-mono text-[11px] uppercase text-ac">СЛОТ</span>
              <span className="text-xs text-mu">старая карта уходит</span>
            </div>
          </div>
        )}
        {step === 2 && sampleStat && (
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-fg">
                <StatGlyph shape={sampleStat.shape} color={sampleStat.color} size={12} />
                {sampleStat.label} {formatStatValue(team.computedStats.total[sampleStat.id] ?? 0)}
              </span>
              <StatMeter
                stat={sampleStat}
                value={team.computedStats.total[sampleStat.id] ?? 0}
                marks={getThresholdsForStat(template, team.activePerkId, sampleStat.id)}
              />
            </div>
            <StepBlocks step={team.computedStats.step} stats={template.stats} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[21px] leading-tight font-semibold text-fg">{titles[step]}</h3>
        <p className="text-sm leading-relaxed text-mu">{texts[step]}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onDone} className="min-h-[44px] text-sm font-medium text-ac">
          Пропустить
        </button>
        <button
          type="button"
          onClick={() => (step < STEPS - 1 ? setStep(step + 1) : onDone())}
          className="h-11 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
        >
          {step < STEPS - 1 ? "Дальше" : "Начать игру"}
        </button>
      </div>
    </div>
  );
}
