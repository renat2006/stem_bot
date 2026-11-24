import {
  computeEffectiveMissionStats,
  computeEquippedCircuitLoad,
  computeUnlockedActionTags,
  defaultPowerCircuit,
  evaluateDualForecast,
  evaluateMissionOutcome,
  type MissionTeamOrders,
  resolveDayEngine,
  resolveDiagnosisDay,
  resolveLexicon,
  resolveMissionDay,
  TeamRoundStateSchema,
} from "@stem/shared";
import { Check, CheckCircle2, Lock, MessageCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import {
  pingTeamSlot,
  runDiagnosisProbe,
  saveTransferNote,
  submitDiagnosisVerdict,
  submitProgramOrder,
} from "../../../features/purchase/index.js";
import { type RunAction, useTelegram } from "../../../shared/lib/index.js";
import {
  CircuitAlertPill,
  CrewStationsStrip,
  ForecastCards,
  Mark,
  ProbeDiagram,
  ResourceMeter,
  RouteMap,
  sectorName,
} from "../../../shared/ui/index.js";

interface RoundScreenProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  secondsLeft: number | null;
  run: RunAction;
  onToast: (text: string) => void;
}

function formatClock(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RoundScreen({ snapshot, team, secondsLeft, run, onToast }: RoundScreenProps) {
  const { hapticTap } = useTelegram();
  const { template, gameState, viewer } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const day = gameState.currentDay;
  const roundMode = gameState.roundMode ?? "idle";
  const dayEngine = gameState.roundEngine ?? resolveDayEngine(template, day);

  const missionDay =
    snapshot.currentMissionDay?.day === day ? snapshot.currentMissionDay : resolveMissionDay(template, day);
  const diagDay =
    snapshot.currentDiagnosisDay?.day === day
      ? snapshot.currentDiagnosisDay
      : resolveDiagnosisDay(template, day, true);
  const roundState = TeamRoundStateSchema.parse(team.roundState ?? {});
  const orders = roundState.orders;

  const [simOrders, setSimOrders] = useState<MissionTeamOrders | null>(null);
  const [selectedHypId, setSelectedHypId] = useState<string | null>(roundState.selectedHypothesisId);
  const [noteInput, setNoteInput] = useState(roundState.transferNote);
  const [noteSaved, setNoteSaved] = useState(Boolean(roundState.transferNote));

  const stats = computeEffectiveMissionStats(team, template);
  const equippedLoad = computeEquippedCircuitLoad(team.equippedCards, template);
  const unlockedTags = computeUnlockedActionTags(team.equippedCards, template);
  const circuit = defaultPowerCircuit(template);

  const dualForecast = evaluateDualForecast({
    stats,
    day: missionDay,
    orders,
    circuit,
    equippedLoad,
  });

  const assignedLevers = viewer.assignedLevers?.length ? viewer.assignedLevers : [0];
  const [activeLeverTab, setActiveLeverTab] = useState<number>(() => assignedLevers[0] ?? 0);
  const currentLever = assignedLevers.includes(activeLeverTab) ? activeLeverTab : (assignedLevers[0] ?? 0);

  const teamMembers = snapshot.members[team.id] ?? [];
  const leverTitles = [
    "Маршрут A",
    "Темп A",
    "Темп B",
    lexicon.extraRiskLabel,
    `${lexicon.reserveLabel} (+2)`,
  ];

  const leverOwnerName = (slotIdx: number) => {
    if (teamMembers.length === 0) return "Экипаж";
    const ownerIdx = slotIdx % teamMembers.length;
    return teamMembers[ownerIdx]?.displayName ?? `Участник ${slotIdx + 1}`;
  };

  const formatLeverChoice = (slotIdx: number, src: MissionTeamOrders) => {
    if (slotIdx === 0) {
      return missionDay.routesA.find((r) => r.id === src.routeId)?.label ?? "Короткий";
    }
    if (slotIdx === 1 || slotIdx === 2) {
      const p = slotIdx === 1 ? src.paceA : src.paceB;
      return p === "fast" ? "Быстрый (+1 очк.)" : p === "pause" ? "Пауза (−1 нагрев)" : "Обычный";
    }
    if (slotIdx === 3) {
      return src.extraCargo ? `${lexicon.extraRiskLabel} (+2 очк.)` : "Без риска";
    }
    return `Участок ${src.reserveTarget}`;
  };

  const timerLabel = formatClock(secondsLeft);

  if (dayEngine === "legacy_track" && roundMode === "idle") {
    return null;
  }

  if (roundMode === "diagnosis" || (dayEngine === "diagnosis" && roundMode !== "revealed")) {
    const usedProbes = roundState.usedProbes;
    const potentialPts = Math.max(1, 3 - usedProbes.length);
    const chosenHyp = selectedHypId ?? roundState.selectedHypothesisId;

    return (
      <section className="space-y-4 border-b border-ln pb-5" aria-label={lexicon.diagnosisLabel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-lg bg-sf2 px-2.5 py-1 text-xs font-bold text-fg">
            {lexicon.diagnosisLabel}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-mu">Бюджет раунда: 0</span>
            {timerLabel && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sf2 px-2.5 py-1 text-xs font-bold text-fg">
                <Mark kind="clock" />
                {timerLabel}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="atlas-h1">Найдите причину</h2>
          <p className="atlas-lead">{diagDay.symptom}</p>
        </div>

        <ProbeDiagram
          measurements={usedProbes.length}
          maxProbes={diagDay.maxProbes}
          available={diagDay.hypotheses.map((h) => !roundState.eliminatedHypotheses[h.id])}
        />

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-fg">1. Приборные замеры</h3>
          {diagDay.probes.map((probe) => {
            const done = usedProbes.includes(probe.id);
            const obs = roundState.probeObservations[probe.id];
            return (
              <div key={probe.id} className="rounded-xl border border-ln bg-sf p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{probe.label}</span>
                  {!done && !roundState.diagnosisSubmitted && (
                    <button
                      type="button"
                      disabled={usedProbes.length >= diagDay.maxProbes}
                      onClick={() => {
                        hapticTap();
                        void run(() => runDiagnosisProbe(probe.id));
                      }}
                      className="min-h-[40px] shrink-0 rounded-xl bg-ac px-3.5 py-1.5 text-xs font-bold text-acfg disabled:opacity-45"
                    >
                      Проверить
                    </button>
                  )}
                </div>
                {done && obs && (
                  <p className="mt-2 rounded-lg bg-pos/10 px-2.5 py-1.5 text-xs font-bold text-pos">
                    Наблюдение: {obs}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-fg">2. Что вызвало сбой?</h3>
            <span className="rounded-lg bg-sf2 px-2 py-0.5 text-xs font-bold text-ac">
              Награда +{potentialPts} очк.
            </span>
          </div>
          <div className="space-y-1.5">
            {diagDay.hypotheses.map((hyp) => {
              const elimReason = roundState.eliminatedHypotheses[hyp.id];
              const isSelected = chosenHyp === hyp.id;
              return (
                <button
                  key={hyp.id}
                  type="button"
                  disabled={roundState.diagnosisSubmitted || Boolean(elimReason)}
                  aria-pressed={isSelected}
                  onClick={() => {
                    hapticTap();
                    setSelectedHypId(hyp.id);
                  }}
                  className="atlas-item-btn"
                >
                  <span>{hyp.label}</span>
                  <small>{elimReason ? "Отсеяно приборным замером" : hyp.explanation}</small>
                </button>
              );
            })}
          </div>
        </div>

        {!roundState.diagnosisSubmitted ? (
          <button
            type="button"
            disabled={!chosenHyp}
            onClick={() => {
              if (!chosenHyp) return;
              void run(async () => {
                const res = await submitDiagnosisVerdict(chosenHyp);
                onToast("Вердикт диагностики команды отправлен");
                return res;
              });
            }}
            className="atlas-primary"
          >
            Зафиксировать диагноз команды
          </button>
        ) : (
          <div className="rounded-xl border border-pos/30 bg-pos/10 p-3.5 text-sm">
            <p className="font-bold text-fg">
              Вердикт зафиксирован: +{roundState.lastRoundPoints} очк. в сезон (валюта: 0)
            </p>
            <p className="mt-1 text-xs text-mu">{diagDay.transferPrompt}</p>
          </div>
        )}
      </section>
    );
  }

  if (roundMode === "revealed" || gameState.currentPhase === "summary") {
    const revealedCond =
      missionDay.conditions.find((c) => c.id === gameState.revealedConditionId) ?? missionDay.conditions[0];
    if (!revealedCond) return null;

    const totalWeight = missionDay.conditions.reduce((s, c) => s + c.weight, 0);
    const activeOrders = simOrders ?? orders;
    const out = evaluateMissionOutcome({
      stats,
      day: missionDay,
      orders: activeOrders,
      condition: revealedCond,
      totalWeight,
      circuit,
      equippedLoad,
    });

    return (
      <section className="space-y-4 border-b border-ln pb-5" aria-label="Разбор и контрфактуал">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-mu">
          <span>
            {simOrders
              ? "Симуляция одной правки (вне зачёта)"
              : `${lexicon.environmentLabel}: ${revealedCond.label}`}
          </span>
          <span className="rounded-md bg-sf2 px-2 py-0.5 text-fg">Валюта раунда: 0</span>
        </div>

        <div className="round-receipt">
          <p>
            <Mark kind="route" />
            <span>Итог раунда</span>
          </p>
          <h2>+{out.totalPoints} очк.</h2>
          <span className="text-sm opacity-90">{revealedCond.label}</span>
        </div>

        <div className="sector-results">
          {[
            { label: sectorName(lexicon.sectorALabel), sec: out.sectorA },
            { label: sectorName(lexicon.sectorBLabel), sec: out.sectorB },
          ].map(({ label, sec }) => (
            <div key={label}>
              <strong className="text-sm font-bold text-fg">{label}</strong>
              <b className="text-sm font-extrabold tabular-nums text-ac">+{sec.points}</b>
              <ResourceMeter value={sec.resource} threshold={sec.threshold} />
              <small>
                {sec.trippedCircuit
                  ? "Сработала отсечка нагрузки"
                  : sec.passed
                    ? `Запас ${sec.resource} из ${sec.threshold}`
                    : `Не хватило: ${sec.resource} из ${sec.threshold}`}
              </small>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 rounded-2xl border border-ln bg-sf p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-fg">А если распределить иначе?</h3>
            {simOrders && (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setSimOrders(null);
                }}
                className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-ac"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Сбросить</span>
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-mu">{out.counterfactual.tradeoffText}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setSimOrders({
                  ...activeOrders,
                  reserveTarget: activeOrders.reserveTarget === "A" ? "B" : "A",
                });
              }}
              className="atlas-quiet"
            >
              <Mark kind="reserve" />
              <span>Проверить резерв в {activeOrders.reserveTarget === "A" ? "B" : "A"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setSimOrders({
                  ...activeOrders,
                  extraCargo: !activeOrders.extraCargo,
                });
              }}
              className="atlas-quiet"
            >
              <span>
                {activeOrders.extraCargo
                  ? "Без дополнительного риска"
                  : `С опцией «${lexicon.extraRiskLabel}»`}
              </span>
            </button>
          </div>
        </div>

        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!noteInput.trim()) return;
            void run(async () => {
              const res = await saveTransferNote(noteInput);
              setNoteSaved(true);
              onToast("Параметр реального проекта сохранён");
              return res;
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-fg">{missionDay.transferPrompt}</span>
            <input
              value={noteInput}
              onChange={(e) => {
                setNoteSaved(false);
                setNoteInput(e.target.value);
              }}
              maxLength={240}
              placeholder={`Что замерите на ${lexicon.workshopNoun}...`}
              className="min-h-[46px] w-full rounded-xl border border-ln bg-sf px-3.5 py-2.5 text-sm text-fg focus:border-ac focus:outline-none"
            />
          </label>
          <button type="submit" disabled={!noteInput.trim()} className="atlas-primary">
            {noteSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Ответ команды сохранён</span>
              </>
            ) : (
              <span>Сохранить ответ команды</span>
            )}
          </button>
        </form>
      </section>
    );
  }

  const isBlind = roundMode === "blind_draft";
  const isLiveProgram = roundMode === "blind_draft" || roundMode === "negotiation";

  if (!isLiveProgram) {
    return null;
  }

  const pinged = roundState.pingedSlots.includes(currentLever);
  const f0 = dualForecast[0];
  const maxPeak = Math.max(f0?.sectorA.peakLoad ?? 0, f0?.sectorB.peakLoad ?? 0);
  const maxHeat = Math.max(f0?.sectorA.heatAfter ?? 0, f0?.sectorB.heatAfter ?? 0);
  const tripped = Boolean(f0?.sectorA.trippedCircuit || f0?.sectorB.trippedCircuit);

  return (
    <section className="space-y-4 border-b border-ln pb-5" aria-label={lexicon.programLabel}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-sf2 px-2.5 py-1 text-xs font-bold text-fg">
          {isBlind ? "Личный выбор" : "Согласование экипажа"}
        </span>
        {timerLabel && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sf2 px-2.5 py-1 text-sm font-extrabold tabular-nums text-fg">
            <Mark kind="clock" />
            {timerLabel}
          </span>
        )}
      </div>

      {pinged && (
        <p
          role="status"
          className="rounded-xl border border-ac/30 bg-sf2 px-3.5 py-2.5 text-xs font-bold text-ac"
        >
          Команда просит обсудить ваш выбор
        </p>
      )}

      {assignedLevers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {assignedLevers.map((lv) => (
            <button
              key={lv}
              type="button"
              aria-pressed={currentLever === lv}
              onClick={() => {
                hapticTap();
                setActiveLeverTab(lv);
              }}
              className={`min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-bold ${
                currentLever === lv ? "bg-ac text-acfg" : "border border-ln bg-sf text-fg"
              }`}
            >
              #{lv + 1} {leverTitles[lv]}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <p className="flex items-center gap-2 text-xs font-bold text-ac">
          <Mark kind={currentLever === 4 ? "reserve" : "route"} />
          <span>Ваш рычаг: {leverTitles[currentLever]}</span>
        </p>
        <h2 className="atlas-h1">
          {currentLever === 0
            ? "Какой путь выбрать?"
            : currentLever === 1 || currentLever === 2
              ? `Как пройти участок ${currentLever === 1 ? "A" : "B"}?`
              : currentLever === 3
                ? `Берём «${lexicon.extraRiskLabel}»?`
                : "Куда направить резерв?"}
        </h2>

        {currentLever === 0 && (
          <div className="space-y-2">
            {missionDay.routesA.map((route) => {
              const locked =
                Boolean(route.requiredTag) &&
                (!template.features.actionTags || !unlockedTags.has(route.requiredTag ?? ""));
              const selected = orders.routeId === route.id;
              const stLabel = template.stats.find((s) => s.id === route.statId)?.label ?? route.statId;
              return (
                <button
                  key={route.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={selected}
                  onClick={() => {
                    hapticTap();
                    void run(() => submitProgramOrder(0, route.id));
                  }}
                  className="atlas-item-btn"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      {route.label} {route.bonusPoints > 0 ? `(+${1 + route.bonusPoints} очк.)` : "(+1 очк.)"}
                    </span>
                    {locked ? (
                      <Lock className="h-4 w-4 shrink-0" />
                    ) : (
                      selected && <Check className="h-4 w-4 shrink-0" />
                    )}
                  </span>
                  <small>
                    Нужно: {stLabel} от {route.min}
                    {route.requiredTag ? ` · Узел: ${route.tagCardName}` : ""}
                  </small>
                </button>
              );
            })}
          </div>
        )}

        {(currentLever === 1 || currentLever === 2) && (
          <div className="space-y-2">
            {(
              [
                { id: "normal", label: "Обычный", hint: "Базовый порог участка" },
                { id: "fast", label: "Быстрый (+1 очк.)", hint: "Порог выше на 2, нагрузка +1" },
                ...(template.features.powerCircuit !== false
                  ? [{ id: "pause", label: "Пауза (−1 нагрев)", hint: "0 очков, охлаждение шины" }]
                  : []),
              ] as const
            ).map((opt) => {
              const cur = currentLever === 1 ? orders.paceA : orders.paceB;
              const selected = cur === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    hapticTap();
                    void run(() => submitProgramOrder(currentLever, opt.id));
                  }}
                  className="atlas-item-btn"
                >
                  <span>{opt.label}</span>
                  <small>{opt.hint}</small>
                </button>
              );
            })}
          </div>
        )}

        {currentLever === 3 && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: false, label: "Без риска", sub: "Базовый порог B" },
              { val: true, label: `${lexicon.extraRiskLabel} (+2)`, sub: "Порог B выше на 2" },
            ].map((item) => (
              <button
                key={String(item.val)}
                type="button"
                aria-pressed={orders.extraCargo === item.val}
                onClick={() => {
                  hapticTap();
                  void run(() => submitProgramOrder(3, item.val));
                }}
                className="atlas-item-btn"
              >
                <span>{item.label}</span>
                <small>{item.sub}</small>
              </button>
            ))}
          </div>
        )}

        {currentLever === 4 && (
          <RouteMap
            target={orders.reserveTarget}
            labels={[lexicon.sectorALabel, lexicon.sectorBLabel]}
            onSelect={(v) => {
              hapticTap();
              void run(() => submitProgramOrder(4, v));
            }}
          />
        )}
      </div>

      {!isBlind && (
        <div className="space-y-3 pt-1">
          <p className="text-xs font-bold text-mu">Прогноз по условиям среды</p>
          <ForecastCards
            items={dualForecast.map((out) => ({
              id: out.condition.id,
              label: out.condition.label,
              probabilityPercent: out.probabilityPercent,
              totalPoints: out.totalPoints,
            }))}
          />

          {circuit.enabled && (
            <CircuitAlertPill
              label={lexicon.circuitLabel}
              peakLoad={maxPeak}
              capacity={circuit.baseCapacity}
              heat={maxHeat}
              maxHeat={circuit.maxAccumulatedHeat}
              tripped={tripped}
            />
          )}
        </div>
      )}

      {isBlind ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-bold text-mu">
            Готовность пультов ({roundState.readySlots.length} из 5)
          </p>
          <CrewStationsStrip readySlots={roundState.readySlots} labels={leverTitles} />
        </div>
      ) : (
        <div className="divide-y divide-ln rounded-2xl border border-ln bg-sf px-3.5">
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            const isMine = assignedLevers.includes(slotIdx);
            return (
              <div key={slotIdx} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-fg">{leverOwnerName(slotIdx)}</p>
                  <p className="truncate text-xs text-mu">
                    {leverTitles[slotIdx]}: {formatLeverChoice(slotIdx, orders)}
                  </p>
                </div>
                {!isMine && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      void run(async () => {
                        const res = await pingTeamSlot(slotIdx);
                        onToast("Отправлен сигнал обсуждения сокоманднику");
                        return res;
                      });
                    }}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg border border-ln bg-sf2 px-2.5 text-xs font-bold text-fg"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-ac" />
                    <span>Обсудить</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
