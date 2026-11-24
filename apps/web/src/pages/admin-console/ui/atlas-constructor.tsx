import {
  BUILTIN_CARD_TAGS,
  type DayScheduleItem,
  defaultPowerCircuit,
  type RoundEngineType,
  resolveDaySchedule,
  resolveLexicon,
  resolveMissionDay,
  type TemplateLexicon,
  validateParetoStrategies,
} from "@stem/shared";
import { Check, ChevronRight, Printer } from "lucide-react";
import { useState } from "react";
import { renderSVG } from "uqr";
import { PackIllustration, PartSticker } from "../../../entities/assembly/index.js";
import type { GameSnapshot } from "../../../entities/game/index.js";
import {
  applyParetoFix,
  resetEvent,
  startRoundEngine,
  updateDaySchedule,
  updateFeatures,
  updateTemplateLexicon,
} from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { StatImpactPills } from "../../../shared/ui/index.js";

const LEXICON_FIELDS: Array<{ key: keyof TemplateLexicon; label: string }> = [
  { key: "objectName", label: "Объект" },
  { key: "currencyLabel", label: "Валюта" },
  { key: "reserveLabel", label: "Резерв" },
  { key: "environmentLabel", label: "Среда" },
  { key: "circuitLabel", label: "Контур" },
  { key: "extraRiskLabel", label: "Риск" },
  { key: "sectorALabel", label: "Участок A" },
  { key: "sectorBLabel", label: "Участок B" },
];

export function AtlasConstructor({
  snapshot,
  run,
  onOpenCardsTab,
  onSwitchToLive,
}: {
  snapshot: GameSnapshot;
  run: RunAction;
  onOpenCardsTab: () => void;
  onSwitchToLive: () => void;
}) {
  const { template, teams, availableTemplates } = snapshot;
  const serverLexicon = snapshot.lexicon ?? resolveLexicon(template);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draftLexicon, setDraftLexicon] = useState<TemplateLexicon>(serverLexicon);
  const [schedule, setSchedule] = useState<DayScheduleItem[]>(() => resolveDaySchedule(template));

  const syncKey = `${template.id}:${snapshot.rulesVersion}`;
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    setDraftLexicon(snapshot.lexicon ?? resolveLexicon(template));
    setSchedule(resolveDaySchedule(template));
  }

  const s0 = template.stats[0]?.id ?? "speed";
  const s1 = template.stats[1]?.id ?? s0;
  const s2 = template.stats[2]?.id ?? s1;
  const missionDay = snapshot.currentMissionDay ?? resolveMissionDay(template, 3);
  const pareto =
    snapshot.paretoCheck ??
    validateParetoStrategies({
      day: missionDay,
      referenceStats: { [s0]: 4, [s1]: 5, [s2]: 4 },
      circuit: defaultPowerCircuit(template),
    });

  const maxScoreBar = Math.max(1, ...pareto.safeScores, ...pareto.riskScores) + 1;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://stem-bot.local";

  return (
    <section className="space-y-5" aria-label="Конструктор смены">
      <div className="space-y-1">
        <p className="text-sm text-mu">Подготовка смены · {template.title}</p>
        <h1 className="atlas-h1">Конструктор смены</h1>
      </div>

      <nav aria-label="Шаги конструктора" className="atlas-pills">
        {[
          { id: 1 as const, label: "1. Словарь" },
          { id: 2 as const, label: "2. Дни" },
          { id: 3 as const, label: "3. Каталог" },
          { id: 4 as const, label: "4. Запуск" },
        ].map((s) => (
          <button key={s.id} type="button" aria-pressed={step === s.id} onClick={() => setStep(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      {step === 1 && (
        <div className="space-y-5">
          <div className="editor-grid">
            <div className="space-y-4">
              <h2 className="atlas-h2">Словарь смены</h2>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-mu">Базовый шаблон мира</span>
                <div className="flex flex-wrap gap-1.5">
                  {availableTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      aria-pressed={tpl.id === template.id}
                      onClick={() => void run(() => resetEvent(tpl.id, true))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                        tpl.id === template.id ? "bg-ac text-acfg" : "border border-ln bg-sf text-fg"
                      }`}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {LEXICON_FIELDS.map((field) => (
                  <label key={field.key} className="block space-y-1">
                    <span className="text-sm font-medium text-fg">{field.label}</span>
                    <input
                      value={draftLexicon[field.key]}
                      onChange={(e) => setDraftLexicon((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-ln bg-sf px-3 py-2 text-sm text-fg focus:border-ac focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void run(() => updateTemplateLexicon(draftLexicon))}
                className="atlas-quiet text-xs"
              >
                Сохранить словарь
              </button>
            </div>

            <aside className="studio-preview">
              <small className="text-xs font-semibold text-mu">На телефоне участника</small>
              <PackIllustration
                template={template}
                kind="hero"
                label={draftLexicon.objectName}
                className="aspect-[2/1] w-full rounded-lg object-cover"
              />
              <h3 className="atlas-h2">{draftLexicon.objectName}</h3>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="rounded-lg border border-ln bg-sf px-2.5 py-1 text-fg">
                  {draftLexicon.currencyLabel}: 3 {draftLexicon.currencyUnit}
                </span>
                <span className="rounded-lg bg-ac/14 px-2.5 py-1 text-ac">
                  {draftLexicon.reserveLabel}: {draftLexicon.sectorALabel}
                </span>
              </div>
              <p className="text-sm text-mu">{draftLexicon.environmentLabel}</p>
            </aside>
          </div>

          <button
            type="button"
            onClick={() => {
              void run(() => updateTemplateLexicon(draftLexicon));
              setStep(2);
            }}
            className="atlas-primary"
          >
            <span>Дальше</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 className="atlas-h2">Расписание</h2>

          <label className="block max-w-xs space-y-1">
            <span className="text-sm font-medium text-fg">Длительность смены</span>
            <select
              value={schedule.length}
              onChange={(e) => {
                const nextLen = Number(e.target.value);
                const nextSched: DayScheduleItem[] = Array.from({ length: nextLen }, (_, i) => ({
                  day: i + 1,
                  engine: schedule[i]?.engine ?? (i === 1 ? "diagnosis" : "mission"),
                }));
                setSchedule(nextSched);
                void run(() => updateDaySchedule({ totalDays: nextLen, daySchedule: nextSched }));
              }}
              className="w-full rounded-lg border border-ln bg-sf px-3 py-2.5 text-sm font-semibold text-fg"
            >
              {[3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d} дн.
                </option>
              ))}
            </select>
          </label>

          <div className="atlas-days">
            {schedule.map((item, idx) => (
              <label key={item.day} className="block space-y-1.5">
                <span className="text-sm font-semibold text-fg">День {item.day}</span>
                <select
                  value={item.engine}
                  onChange={(e) => {
                    const engine = e.target.value as RoundEngineType;
                    const nextSched = schedule.map((r, rIdx) => (rIdx === idx ? { ...r, engine } : r));
                    setSchedule(nextSched);
                    void run(() =>
                      updateDaySchedule({ totalDays: nextSched.length, daySchedule: nextSched }),
                    );
                  }}
                  className="w-full rounded-lg border border-ln bg-sf px-2.5 py-2 text-sm text-fg"
                >
                  <option value="mission">Миссия</option>
                  <option value="diagnosis">Диагностика</option>
                  <option value="legacy_track">Классический трек</option>
                </select>
              </label>
            ))}
          </div>

          <div className="space-y-2.5">
            <h3 className="atlas-h2">Дополнения</h3>
            <div className="space-y-2">
              {(
                [
                  { key: "powerCircuit", label: "Контур нагрузки и перегрева" },
                  { key: "actionTags", label: "Особые маршруты по тегам узлов" },
                  { key: "offClassPlayground", label: "Тренировка без зачёта (3 мин)" },
                  { key: "openMilestones", label: "Открытые инженерные вехи" },
                ] as const
              ).map((addon) => (
                <label key={addon.key} className="flex items-center gap-2.5 text-sm font-medium text-fg">
                  <input
                    type="checkbox"
                    checked={template.features[addon.key] !== false}
                    onChange={(e) => void run(() => updateFeatures({ [addon.key]: e.target.checked }))}
                  />
                  <span>{addon.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setStep(3)} className="atlas-primary">
            <span>Дальше</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="atlas-h2">День {missionDay.day} · Проверка двух стратегий</h2>
            <p className="text-sm text-mu">Контрольная сборка · порог короткого пути {pareto.currentMinA}</p>
          </div>

          <div className="strategy-chart">
            {[
              { title: "Короткий путь", values: pareto.safeScores },
              { title: "Дополнительный риск", values: pareto.riskScores },
            ].map((plan) => (
              <div key={plan.title}>
                <strong className="text-sm font-bold text-fg">{plan.title}</strong>
                {plan.values.map((pts, idx) => (
                  <div className="strategy-bar" key={pareto.conditionLabels[idx] ?? idx}>
                    <span>{pareto.conditionLabels[idx]}</span>
                    <i
                      style={{
                        width: `${(Math.max(1, pts) * 100) / maxScoreBar}%`,
                        opacity: pts === 0 ? 0 : 1,
                      }}
                    />
                    <b>{pts} очк.</b>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {!pareto.balanced ? (
            <div className="space-y-2.5">
              <p className="text-sm text-mu">{pareto.summary}</p>
              <button
                type="button"
                onClick={() => void run(() => applyParetoFix(missionDay.day))}
                className="atlas-quiet"
              >
                Снизить порог до {pareto.suggestedMinA}
              </button>
            </div>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-pos">
              <Check className="h-4 w-4" />У каждого плана есть своё преимущество
            </p>
          )}

          <details className="border-t border-ln pt-3">
            <summary className="cursor-pointer py-1 text-sm font-bold text-fg">
              Каталог · {template.cards.length} деталей
            </summary>
            <div className="mt-3 divide-y divide-ln">
              {template.cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PartSticker card={card} template={template} thumbnail />
                    <div className="min-w-0 space-y-1">
                      <strong className="block truncate font-semibold text-fg">{card.name}</strong>
                      <StatImpactPills
                        stats={template.stats}
                        deltas={card.stats}
                        actionBadge={card.actionBadge ?? BUILTIN_CARD_TAGS[card.id]?.badgeLabel}
                      />
                    </div>
                  </div>
                  <b className="shrink-0 font-mono text-xs text-fg tabular-nums">
                    {card.price} {draftLexicon.currencyUnit}
                  </b>
                </div>
              ))}
              <div className="pt-3">
                <button type="button" onClick={onOpenCardsTab} className="atlas-quiet text-xs">
                  <span>Открыть полный редактор и генератор карт</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </details>

          <button type="button" onClick={() => setStep(4)} className="atlas-primary">
            <span>Дальше</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="qr-print-zone space-y-5">
          <div className="space-y-1">
            <h2 className="atlas-h2">Вход команд ({teams.length})</h2>
            <p className="text-sm text-mu">
              Распечатайте QR-карточки для столов или запустите репетиционный раунд.
            </p>
          </div>

          <div className="qr-grid">
            {teams.map((team) => {
              const joinUrl = `${origin}/?join=${encodeURIComponent(team.joinCode)}`;
              const qrSvg = renderSVG(joinUrl, { border: 1 });
              return (
                <figure key={team.id}>
                  <div
                    className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: deterministic local SVG from uqr
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <figcaption>
                    {team.name} · <span className="font-mono font-bold select-all">{team.joinCode}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>

          <div className="space-y-2.5">
            <button type="button" onClick={() => window.print()} className="atlas-quiet w-full">
              <Printer className="h-4 w-4" />
              <span>Печать QR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void run(() => startRoundEngine({ engine: "mission", durationSeconds: 120 }));
                onSwitchToLive();
              }}
              className="atlas-primary centered"
            >
              Пройти тестовый раунд
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
