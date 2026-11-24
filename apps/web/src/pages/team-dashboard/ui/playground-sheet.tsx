import {
  defaultPowerCircuit,
  evaluateDiagnosisVerdict,
  evaluateMissionOutcome,
  evaluateProbeObservation,
  type GameTemplate,
  resolveDiagnosisDay,
  resolveLexicon,
  resolveMissionDay,
} from "@stem/shared";
import { CheckCircle2, Share2 } from "lucide-react";
import { useState } from "react";
import { useTelegram } from "../../../shared/lib/index.js";
import { BottomSheet, ProbeDiagram, RouteMap, TrainingSketch } from "../../../shared/ui/index.js";

interface PlaygroundSheetProps {
  open: boolean;
  onClose: () => void;
  template: GameTemplate;
  onToast?: (text: string) => void;
}

export function PlaygroundSheet({ open, onClose, template, onToast }: PlaygroundSheetProps) {
  const { hapticTap, hapticSuccess } = useTelegram();
  const lexicon = resolveLexicon(template);
  const missionDay = resolveMissionDay(template, 4);
  const diagDay = resolveDiagnosisDay(template, 3, false);
  const circuit = defaultPowerCircuit(template);

  const s0 = template.stats[0]?.id ?? "speed";
  const s1 = template.stats[1]?.id ?? s0;
  const s2 = template.stats[2]?.id ?? s1;
  const puzzleStats = { [s0]: 4, [s1]: 5, [s2]: 6 };
  const stormCond = missionDay.conditions[1] ?? missionDay.conditions[0];

  const [mode, setMode] = useState<"rescue" | "diag">("rescue");
  const [reserveTarget, setReserveTarget] = useState<"A" | "B">("A");
  const [extraCargo, setExtraCargo] = useState(true);

  const [probesUsed, setProbesUsed] = useState<string[]>([]);
  const [hypSelected, setHypSelected] = useState<string | null>(null);
  const [diagChecked, setDiagChecked] = useState(false);

  const beforeOut = stormCond
    ? evaluateMissionOutcome({
        stats: puzzleStats,
        day: missionDay,
        orders: { routeId: "detour", paceA: "normal", paceB: "normal", extraCargo: true, reserveTarget: "A" },
        condition: stormCond,
        totalWeight: 2,
        circuit,
        equippedLoad: 3,
      })
    : null;

  const afterOut = stormCond
    ? evaluateMissionOutcome({
        stats: puzzleStats,
        day: missionDay,
        orders: {
          routeId: extraCargo ? "detour" : "short",
          paceA: "normal",
          paceB: "normal",
          extraCargo,
          reserveTarget,
        },
        condition: stormCond,
        totalWeight: 2,
        circuit,
        equippedLoad: 3,
      })
    : null;

  const probeInfo = evaluateProbeObservation(diagDay, probesUsed);
  const diagResult =
    diagChecked && hypSelected
      ? evaluateDiagnosisVerdict({
          day: diagDay,
          hypothesisId: hypSelected,
          usedProbesCount: probesUsed.length,
        })
      : null;

  const shareChallenge = () => {
    hapticSuccess();
    const shareUrl = `${window.location.origin}/?playground=puzzle_${template.eventKey}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
    }
    onToast?.("Ссылка на 3-минутный вызов скопирована для отправки в Telegram");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Полигон вне занятий · 3 минуты">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-sf2 px-3.5 py-2.5 text-xs font-bold text-fg">
          <span>Тренировка без зачёта</span>
          <span className="rounded-md bg-sf px-2 py-0.5 text-mu">0 {lexicon.currencyUnit}</span>
        </div>

        <div className="training-picks">
          <button
            type="button"
            aria-pressed={mode === "rescue"}
            onClick={() => {
              hapticTap();
              setMode("rescue");
            }}
          >
            <TrainingSketch />
            <span>Спаси заезд 1 правкой</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "diag"}
            onClick={() => {
              hapticTap();
              setMode("diag");
            }}
          >
            <TrainingSketch diagnosis />
            <span>Диагностика за 2 замера</span>
          </button>
        </div>

        {mode === "rescue" && beforeOut && afterOut && (
          <div className="space-y-3.5">
            <p className="text-sm text-mu">
              Условие «{stormCond?.label}» при включённом «{lexicon.extraRiskLabel}». Выберите участок для
              подачи резерва (+2):
            </p>

            <RouteMap
              target={reserveTarget}
              labels={[lexicon.sectorALabel, lexicon.sectorBLabel]}
              onSelect={(v) => {
                hapticTap();
                setReserveTarget(v);
              }}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-ln bg-sf p-3">
                <span className="text-xs font-semibold text-mu">Было</span>
                <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-mu">
                  +{beforeOut.totalPoints} очк.
                </strong>
              </div>
              <div className="rounded-xl border border-ac/40 bg-sf2 p-3">
                <span className="text-xs font-bold text-ac">После правки</span>
                <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-ac">
                  +{afterOut.totalPoints} очк.
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                setExtraCargo((v) => !v);
              }}
              className="atlas-quiet w-full"
            >
              {extraCargo ? "Проверить без дополнительного риска" : `Вернуть «${lexicon.extraRiskLabel}»`}
            </button>

            {afterOut.totalPoints > beforeOut.totalPoints && (
              <p className="flex items-center gap-2 rounded-xl bg-pos/12 p-3 text-xs font-bold text-pos">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Отлично! Правка увеличила результат с +{beforeOut.totalPoints} до +{afterOut.totalPoints}{" "}
                  очк.
                </span>
              </p>
            )}
          </div>
        )}

        {mode === "diag" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-fg">{diagDay.symptom}</p>
            <ProbeDiagram
              measurements={probesUsed.length}
              maxProbes={2}
              available={diagDay.hypotheses.map((h) => !probeInfo.eliminatedHypotheses[h.id])}
            />

            <div className="space-y-2">
              {diagDay.probes.slice(0, 3).map((p) => {
                const used = probesUsed.includes(p.id);
                return (
                  <div key={p.id} className="rounded-xl border border-ln bg-sf p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-fg">{p.label}</span>
                      {!used && probesUsed.length < 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            hapticTap();
                            setProbesUsed((prev) => [...prev, p.id]);
                          }}
                          className="min-h-[38px] rounded-lg bg-ac px-3 py-1.5 font-bold text-acfg"
                        >
                          Замер
                        </button>
                      )}
                    </div>
                    {used && <p className="mt-1.5 font-semibold text-pos">{probeInfo.observations[p.id]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              {diagDay.hypotheses.map((h) => {
                const outByProbe = probeInfo.eliminatedHypotheses[h.id];
                const selected = hypSelected === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(outByProbe)}
                    onClick={() => {
                      hapticTap();
                      setHypSelected(h.id);
                      setDiagChecked(true);
                    }}
                    className="atlas-item-btn"
                  >
                    <span>{h.label}</span>
                    {outByProbe && <small>Отсеяно приборным замером</small>}
                  </button>
                );
              })}
            </div>

            {diagResult && (
              <p className={`text-xs font-bold ${diagResult.correct ? "text-pos" : "text-neg"}`}>
                {diagResult.correct
                  ? `Точно! Ваш результат: +${diagResult.points} очк.`
                  : "Не совпало с показаниями — попробуйте сделать ещё один замер."}
              </p>
            )}
          </div>
        )}

        <button type="button" onClick={shareChallenge} className="atlas-quiet w-full">
          <Share2 className="h-4 w-4 text-ac" />
          <span>Поделиться вызовом в Telegram</span>
        </button>
      </div>
    </BottomSheet>
  );
}
