import { calculateTeamStep } from "@stem/shared";
import { Check, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Engine3Store } from "../model/engine3-store.js";
import { evaluateMissionOutcome } from "../model/engine3-types.js";
export function ProjectorSurface3({ store: s }: { store: Engine3Store }) {
  const d = s.pack.missionDay;
  const c = d.conditions[s.revealedConditionIdx];
  const mode = s.projectorMode;
  const reveal = mode === "reveal";
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    setOpening(reveal);
    if (!reveal) return;
    const timer = window.setTimeout(() => setOpening(false), 1800);
    return () => window.clearTimeout(timer);
  }, [reveal]);
  if (!c) return null;
  const total = s.phaseSeconds + (s.playerPhase === "e3a" ? 90 : 0);
  const results = s.teams.map((t) => ({
    team: t,
    out: evaluateMissionOutcome({
      day: d,
      orders: t.orders,
      condition: c,
      stats: s.computeEffectiveStats(t),
      totalWeight: d.conditions.reduce((a, v) => a + v.weight, 0),
      circuit: s.circuitConfig,
      equippedLoad:
        2 +
        Object.values(t.equipped).reduce<number>(
          (n, id) => n + (id ? (s.pack.cardTags[id]?.load ?? 0) : 0),
          0,
        ),
    }),
  }));
  if (reveal && s.roundResult === "diagnosis")
    return (
      <article className="hall">
        <header>{s.template.title} · Диагностика</header>
        <h1>
          {s.pack.diagnosisDay.hypotheses.find((h) => h.id === s.pack.diagnosisDay.secretHypothesisId)?.label}
        </h1>
        <p>{s.pack.diagnosisDay.transferPrompt}</p>
      </article>
    );
  if (reveal && s.roundResult === "legacy_track")
    return (
      <article className="hall">
        <header>{s.template.title}</header>
        <h1>Шаг команд</h1>
        <div className="hall-grid">
          {s.teams.map((t) => (
            <div key={t.id}>
              <h2>{t.name}</h2>
              <strong>
                +{calculateTeamStep(s.computeEffectiveStats(t), t.equipped, null, s.template).total}
              </strong>
            </div>
          ))}
        </div>
      </article>
    );
  if (reveal && opening)
    return (
      <article className="hall uncover">
        <header>{s.lexicon.environmentLabel}</header>
        <h1>{c.label}</h1>
      </article>
    );
  return (
    <article className="hall">
      <header>
        {s.template.title} · День {d.day}
      </header>
      <div className="hall-title">
        <h1>
          {reveal
            ? c.label
            : mode === "build"
              ? "Сборка"
              : s.playerPhase === "e3c"
                ? "Диагностика"
                : total > 90
                  ? "Личный выбор"
                  : total > 15
                    ? "Переговоры"
                    : "Фиксация"}
        </h1>
        {!reveal && (
          <strong>
            {Math.floor(total / 60)}:{String(total % 60).padStart(2, "0")}
          </strong>
        )}
      </div>
      {mode === "program" && s.playerPhase !== "e3c" && (
        <div className="hall-timeline">
          {[
            ["Личный выбор", 30],
            ["Переговоры", 75],
            ["Фиксация", 15],
          ].map(([name, length], i) => (
            <div
              key={name}
              style={{ flexGrow: Number(length) }}
              data-active={i === (total > 90 ? 0 : total > 15 ? 1 : 2)}
            >
              <i />
              <span>{name}</span>
            </div>
          ))}
        </div>
      )}
      {mode === "build" && (
        <p>
          {s.lexicon.sectorALabel} · {s.lexicon.sectorBLabel} · {d.conditions.map((c) => c.label).join(" / ")}
        </p>
      )}
      <div className="hall-grid">
        {results.map(({ team: t, out }) => (
          <div key={t.id}>
            <h2>{t.name}</h2>
            {reveal ? (
              <>
                <strong>+{out.totalPoints}</strong>
                <p>
                  {d.routesA.find((r) => r.id === t.orders.routeId)?.label} · резерв {t.orders.reserveTarget}
                </p>
                <p>Сезон · {t.totalSeasonPoints + out.totalPoints}</p>
              </>
            ) : mode === "program" ? (
              <div className="dots">
                {s.crewSlots.map(({ slotIndex: i, memberName }) =>
                  i < t.readyPhones ? <Check key={memberName} /> : <Circle key={memberName} />,
                )}
              </div>
            ) : (
              <p>{t.purchasesToday ? "Собрали" : "Собирают"}</p>
            )}
          </div>
        ))}
      </div>
      {reveal && s.addons.openMilestones && (
        <footer>
          Оба участка прошли · {results.filter((r) => r.out.sectorA.passed && r.out.sectorB.passed).length} из{" "}
          {results.length} команд
        </footer>
      )}
    </article>
  );
}
