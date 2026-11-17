import type { GameTemplate } from "@stem/shared";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { AssemblyStage, PackIllustration } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { getThresholdsForStat, StatMeter, StepBlocks } from "../../../entities/team/index.js";
import { Coin, formatStatValue, RarityBadge, StatGlyph } from "../../../shared/ui/index.js";

const STEPS = 3;
const STEP_IDS = ["world", "build", "race"] as const;

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
  const intro = template.dayBriefings.find((b) => b.day === 0) ?? template.dayBriefings[0];
  const sampleCard = template.cards.find((c) => c.rarity === "rare") ?? template.cards[0];
  const sampleStat = template.stats[0];

  const titles = [
    intro?.title ?? template.title,
    `Собирайте ${template.objectName.toLowerCase()} и торгуйтесь`,
    "Держите баланс характеристик и обгоняйте на маршруте",
  ];
  const texts = [
    intro?.story ??
      `За каждый учебный спринт ваша команда получает ${template.currencyName} и открывает доступ к новым инженерным деталям.`,
    template.features.p2pMarket
      ? "Покупайте модули в общем магазине, обменивайтесь с другими командами на бирже и боритесь за легендарные лоты на аукционе."
      : "Покупайте модули в общем магазине и примеряйте их прямо на интерактивном стенде перед покупкой.",
    "Когда характеристика достигает отметки порога, команда получает дополнительный шаг на маршруте. У мощных редких деталей растут и минусы — компенсируйте их сборкой!",
  ];

  return (
    <div className="space-y-4 pt-1">
      <div className="flex gap-1.5">
        {STEP_IDS.map((id, i) => (
          <div
            key={id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-ac" : "bg-sf2"}`}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ln bg-sf">
        {step === 0 && (
          <div className="space-y-3 p-3.5">
            <PackIllustration
              template={template}
              kind="hero"
              label={template.title}
              className="h-44 w-full rounded-xl border border-ln object-cover"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sf2 px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
                <Sparkles className="h-4 w-4 text-ac" />
                Команда «{team.name}»
              </span>
              <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-fg">
                Старт: {team.currency}
                <Coin size={15} />
              </span>
            </div>
          </div>
        )}

        {step === 1 && sampleCard && (
          <div className="flex min-h-[240px] items-center justify-center gap-3 p-4">
            <div className="flex w-36 -rotate-2 flex-col gap-1.5 rounded-xl border border-ln bg-bg p-3 shadow-sm">
              <RarityBadge rarity={sampleCard.rarity} compact />
              <span className="text-sm leading-snug font-semibold text-fg">{sampleCard.name}</span>
              <StatDeltaList stats={template.stats} deltas={sampleCard.stats} />
            </div>
            <span className="font-mono text-lg text-ac">→</span>
            <AssemblyStage
              template={template}
              equipped={team.equippedCards}
              size="card"
              preview={{ slotId: sampleCard.slotId, cardId: sampleCard.id }}
            />
          </div>
        )}

        {step === 2 && sampleStat && (
          <div className="flex min-h-[240px] flex-col justify-center gap-4 p-5">
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
        <button type="button" onClick={onDone} className="min-h-[44px] text-sm font-medium text-mu">
          Пропустить
        </button>
        <button
          type="button"
          onClick={() => (step < STEPS - 1 ? setStep(step + 1) : onDone())}
          className="h-11 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
        >
          {step < STEPS - 1 ? "Дальше" : "В ангар"}
        </button>
      </div>
    </div>
  );
}
