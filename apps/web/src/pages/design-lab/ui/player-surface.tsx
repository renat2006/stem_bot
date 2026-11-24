import { calculateTeamStep } from "@stem/shared";
import { ArrowDownRight, ArrowUpRight, Clock3, MessageCircle, Route, Share2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Drawer } from "vaul";
import { AssemblyStage, PackIllustration, PartSticker } from "../../../entities/assembly/index.js";
import { useTelegramBackButton } from "../../../shared/lib/index.js";
import type { Engine3Store } from "../model/engine3-store.js";
import { evaluateMissionOutcome, type MissionTeamOrders } from "../model/engine3-types.js";
import { Mark, ProbeDiagram, ResourceMeter, RouteMap, sectorName, TrainingSketch } from "./field-graphics.js";

const pointCount = (n: number) => `${n} ${n === 1 ? "очко" : n >= 2 && n <= 4 ? "очка" : "очков"}`;
type Props = { store: Engine3Store };
const clock = (n: number) => Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
function evaluate(s: Engine3Store, orders: MissionTeamOrders, conditionIndex: number) {
  const day = s.pack.missionDay;
  const condition = day.conditions[conditionIndex];
  if (!condition) throw new Error("Условие раунда отсутствует");
  return evaluateMissionOutcome({
    day,
    orders,
    stats: s.myStats,
    condition,
    totalWeight: day.conditions.reduce((a, b) => a + b.weight, 0),
    circuit: s.circuitConfig,
    equippedLoad: s.equippedLoad,
  });
}
function Forecast({ store: s }: { store: Engine3Store }) {
  return (
    <div className="forecast">
      {s.dualForecast.map((o, i) => (
        <div key={o.condition.id}>
          <span>
            {i ? <ArrowDownRight /> : <ArrowUpRight />}
            {o.probabilityPercent}%
          </span>
          <strong key={o.totalPoints} className="score-change">
            +{o.totalPoints}
          </strong>
          <small>{o.condition.label}</small>
        </div>
      ))}
    </div>
  );
}
function Assembly({ store: s }: Props) {
  const slot = s.template.slots.find((t) => t.id === s.selectedSlotId);
  const [preview, select] = useState("");
  const open = (id: string) => {
    s.setSelectedSlotId(id);
    select("");
    s.setSlotSheetOpen(true);
  };
  const card = s.template.cards.find((c) => c.id === preview);
  const owned = !!card && s.myTeam.warehouse.includes(card.id);
  return (
    <>
      <h1>Выберите деталь</h1>
      <p>
        {s.lexicon.objectName} · Нажмите на место для детали. В запасе {s.myTeam.budget}{" "}
        {s.lexicon.currencyUnit}.
      </p>
      <details>
        <summary>Хватит ли запаса?</summary>
        {s.dualForecast.slice(0, 1).map((o) => (
          <div key={o.condition.id}>
            <p>
              {sectorName(s.lexicon.sectorALabel)} · запас {o.sectorA.resource}, нужно {o.sectorA.threshold}
            </p>
            <p>
              {sectorName(s.lexicon.sectorBLabel)} · запас {o.sectorB.resource}, нужно {o.sectorB.threshold}{" "}
              при условии «{o.condition.label}».
            </p>
          </div>
        ))}
      </details>
      <div className="assembly-layout">
        <AssemblyStage
          template={s.template}
          equipped={s.myTeam.equipped}
          size="card"
          interactive
          onSlotTap={open}
        />
        <div className="slot-list">
          {s.template.slots.map((slot) => {
            const part = s.template.cards.find((c) => c.id === s.myTeam.equipped[slot.id]);
            return (
              <button key={slot.id} type="button" onClick={() => open(slot.id)}>
                {part && <PartSticker template={s.template} card={part} thumbnail />}
                <span>
                  {slot.label}
                  <small>{part?.name ?? "Поставить деталь"}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Drawer.Root open={s.slotSheetOpen} onOpenChange={s.setSlotSheetOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="sheet-overlay" />
          <Drawer.Content className={`lab-sheet dlab-${s.style}`}>
            <Drawer.Title>{slot?.label}</Drawer.Title>
            <Drawer.Description>Одна покупка в день. Детали со склада ставятся бесплатно.</Drawer.Description>
            {s.template.cards
              .filter((c) => c.slotId === slot?.id)
              .map((c) => (
                <button type="button" key={c.id} aria-pressed={preview === c.id} onClick={() => select(c.id)}>
                  <span className="sheet-part">
                    <PartSticker template={s.template} card={c} thumbnail />
                    {c.name}
                  </span>
                  <b>
                    {s.myTeam.equipped[c.slotId] === c.id
                      ? "Установлено"
                      : s.myTeam.warehouse.includes(c.id)
                        ? "Со склада"
                        : c.price + " " + s.lexicon.currencyUnit}
                  </b>
                </button>
              ))}
            {card && (
              <>
                <p>
                  {Object.entries(s.computeEffectiveStats(s.myTeam, card.slotId, card.id))
                    .map(([id, v]) => {
                      const diff = v - (s.myStats[id] ?? 0);
                      return diff
                        ? `${diff > 0 ? "Даёт" : "Платит"} ${Math.abs(diff)} · ${s.template.stats.find((t) => t.id === id)?.label}`
                        : null;
                    })
                    .filter(Boolean)
                    .join(" / ") || "Характеристики сохранятся"}
                </p>
                {s.addons.actionTags && s.pack.cardTags[card.id] && (
                  <p>{s.pack.cardTags[card.id]?.badgeLabel}</p>
                )}
                <button
                  className="primary"
                  type="button"
                  disabled={
                    card.id === s.myTeam.equipped[card.slotId] ||
                    (s.isCaptain && !owned && (s.myTeam.budget < card.price || s.myTeam.purchasesToday >= 1))
                  }
                  onClick={() => s.installCard(card, owned)}
                >
                  {s.isCaptain
                    ? owned
                      ? "Поставить со склада"
                      : "Поставить за " + card.price
                    : "Предложить команде"}
                </button>
              </>
            )}
            <Drawer.Close asChild>
              <button type="button">Закрыть</button>
            </Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
function Program({ store: s }: Props) {
  const blind = s.playerPhase === "e3a";
  const i = s.myPhoneSlot;
  const sectors: [string, string] = [s.lexicon.sectorALabel, s.lexicon.sectorBLabel];
  const question = [
    "Какой путь выбрать?",
    "Как пройти первый участок?",
    "Как пройти второй участок?",
    "Берём дополнительный риск?",
    "Куда направить резерв?",
  ][i];
  const orders = s.myTeam.orders;
  const keys = ["routeId", "paceA", "paceB", "extraCargo", "reserveTarget"] as const;
  const labels = ["Маршрут A", "Темп A", "Темп B", s.lexicon.extraRiskLabel, s.lexicon.reserveLabel];
  const routes = s.pack.missionDay.routesA.filter(
    (r) => !r.requiredTag || (s.addons.actionTags && s.unlockedTags.has(r.requiredTag)),
  );
  const options =
    i === 0
      ? routes.map((r) => [r.id, r.label])
      : i === 1 || i === 2
        ? [
            ["normal", "Обычный"],
            ["fast", "Быстрый"],
            ...(s.addons.powerCircuit ? [["pause", "Пауза (−1 нагрев)"]] : []),
          ]
        : i === 3
          ? [
              ["false", "Без риска"],
              ["true", "Взять риск"],
            ]
          : [
              ["A", "Отдать в A"],
              ["B", "Отдать в B"],
            ];
  const choice = (
    <section className="personal">
      {s.crewSlots[i]?.pinged && <p role="status">Команда хочет обсудить ваш выбор</p>}
      <p className="byline">
        <Mark kind={i === 4 ? "reserve" : "route"} />
        {s.crewSlots[i]?.memberName} · {labels[i]}
      </p>
      <h1>{question}</h1>
      <p>
        {
          [
            "Сравните условия путей. Бонус достанется команде, если сборка пройдёт выбранный путь.",
            "Быстрый темп добавляет очко и повышает порог на 2.",
            "Быстрый темп добавляет очко и повышает порог на 2.",
            "Дополнительные 2 очка поднимают порог B на 2.",
            "Нажмите на участок карты. Он получит +2 к запасу команды. Второй пройдёт со своим запасом.",
          ][i]
        }
      </p>
      {i === 4 ? (
        <RouteMap
          target={orders.reserveTarget}
          labels={sectors}
          onSelect={(v) => s.updateOrder("reserveTarget", v)}
        />
      ) : (
        <div className="choices">
          {options.map(([v, l]) => (
            <button
              type="button"
              key={v}
              aria-pressed={String(orders[keys[i]]) === v}
              onClick={() => {
                if (!v) return;
                if (i === 0) s.updateOrder("routeId", v);
                else if (i === 1 || i === 2)
                  s.updateOrder(i === 1 ? "paceA" : "paceB", v as MissionTeamOrders["paceA"]);
                else if (i === 3) s.updateOrder("extraCargo", v === "true");
                else s.updateOrder("reserveTarget", v as "A" | "B");
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </section>
  );
  const forecast = (
    <section className="prediction">
      <p className="byline">Сколько очков получим</p>
      <Forecast store={s} />
      <details>
        <summary>Сравнить два плана</summary>
        {[false, true].map((risk) => {
          const plan: MissionTeamOrders = {
            routeId: risk ? "detour" : "short",
            paceA: "normal",
            paceB: "normal",
            extraCargo: risk,
            reserveTarget: risk ? "B" : "A",
          };
          return (
            <p key={String(risk)}>
              {risk ? "Дополнительный риск" : "Короткий путь"} ·{" "}
              {s.pack.missionDay.conditions.map((_, i) => evaluate(s, plan, i).totalPoints).join(" / ")} очк.
            </p>
          );
        })}
      </details>
    </section>
  );
  const summary = [
    routes.find((r) => r.id === orders.routeId)?.label,
    ...[orders.paceA, orders.paceB].map((p) => ({ normal: "Обычный", fast: "Быстрый", pause: "Пауза" })[p]),
    orders.extraCargo ? "Взять риск" : "Без риска",
    "В " + orders.reserveTarget,
  ];
  const circuit = s.dualForecast[0];
  return (
    <>
      <div className="round-title">
        <span>{blind ? "Личный выбор" : "Обсуждение команды"}</span>
        <span className="clock">
          <Mark kind="clock" />
          {clock(s.phaseSeconds)}
        </span>
      </div>
      <div className="program-scene">
        {choice}
        {!blind && forecast}
      </div>
      {!blind && s.addons.powerCircuit && circuit && (
        <details className={circuit.sectorA.trippedCircuit || circuit.sectorB.trippedCircuit ? "trip" : ""}>
          <summary>
            {circuit.sectorA.trippedCircuit || circuit.sectorB.trippedCircuit
              ? "Сработала отсечка"
              : s.lexicon.circuitLabel}
          </summary>
          {[circuit.sectorA, circuit.sectorB].map((v, i) => (
            <p key={i === 0 ? "A" : "B"}>
              {i === 0 ? "A" : "B"} · пик {v.peakLoad} / {s.circuitConfig.baseCapacity} · нагрев {v.heatAfter}
            </p>
          ))}
        </details>
      )}
      <section>
        <h2>{blind ? "Кто уже выбрал" : "Решения остальных"}</h2>
        {s.crewSlots
          .filter((c) => blind || c.slotIndex !== i)
          .map((c) => (
            <div className="crew-row" key={c.slotIndex}>
              <span>
                {c.memberName}
                <small>
                  {blind
                    ? c.lockedReady
                      ? "Готов"
                      : "Думает"
                    : labels[c.slotIndex] + " · " + summary[c.slotIndex]}
                </small>
              </span>
              {!blind && (
                <button
                  type="button"
                  onClick={() => s.pingCrewRow(c.slotIndex, c.memberName)}
                  aria-label={"Обсудить с " + c.memberName}
                >
                  <MessageCircle size={16} />
                  {c.pinged ? "Отправлено" : "Обсудить"}
                </button>
              )}
            </div>
          ))}
      </section>
    </>
  );
}
function Diagnosis({ store: s, lesson = false }: Props & { lesson?: boolean }) {
  const d = s.pack.diagnosisDay;
  const [practiceProbes, setPracticeProbes] = useState<string[]>([]);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const used = lesson ? s.lessonProbes : practiceProbes;
  const setUsed = lesson ? s.setLessonProbes : setPracticeProbes;
  const answer = lesson ? s.lessonAnswer : practiceAnswer;
  const submit = lesson ? s.setLessonAnswer : setPracticeAnswer;
  const eliminated = (id: string) =>
    d.probes.find(
      (p) => used.includes(p.id) && p.resultByHypothesis[id] !== p.resultByHypothesis[d.secretHypothesisId],
    );
  return (
    <>
      <h1>Найдите причину</h1>
      <p>{d.symptom}</p>
      <ProbeDiagram measurements={used.length} available={d.hypotheses.map((h) => !eliminated(h.id))} />
      <section>
        <h2>Замеры · {used.length} из 2</h2>
        {d.probes.map((p) => (
          <button
            className="item"
            key={p.id}
            type="button"
            disabled={!!answer || used.includes(p.id) || used.length >= 2}
            onClick={() => setUsed([...used, p.id])}
          >
            {p.label}
            {used.includes(p.id) && <small>{p.resultByHypothesis[d.secretHypothesisId]}</small>}
          </button>
        ))}
      </section>
      <section>
        <h2>Что вызвало сбой?</h2>
        <p>Если ответите сейчас, получите {3 - used.length} очк.</p>
        {d.hypotheses.map((h) => (
          <button
            className="item"
            type="button"
            key={h.id}
            disabled={!!answer || !!eliminated(h.id)}
            onClick={() => {
              submit(h.id);
              if (lesson) s.setDiagnosisScore(h.id === d.secretHypothesisId ? 3 - used.length : 0);
            }}
          >
            {h.label}
            {eliminated(h.id) && <small>Исключил замер «{eliminated(h.id)?.label}»</small>}
          </button>
        ))}
        {answer && (
          <p role="status">
            {answer === d.secretHypothesisId
              ? "Верно · +" + (3 - used.length)
              : "Верный диагноз · " + d.hypotheses.find((h) => h.id === d.secretHypothesisId)?.label}
          </p>
        )}
      </section>
    </>
  );
}
function Playground({ store: s }: Props) {
  const [mode, setMode] = useState("");
  const [fix, setFix] = useState(false);
  const base: MissionTeamOrders = {
    routeId: "detour",
    paceA: "normal",
    paceB: "normal",
    extraCargo: true,
    reserveTarget: "A",
  };
  const share = new URL(location.href);
  share.search = new URLSearchParams({
    design: { a: "1", b: "2", c: "3", cjm: "1" }[s.style],
    world: s.world,
    phase: "e5",
    puzzle: mode || new URLSearchParams(location.search).get("puzzle") || "edit",
  }).toString();
  const puzzle = mode || new URLSearchParams(location.search).get("puzzle");
  return (
    <>
      <h1>Тренировка без зачёта</h1>
      <p>Выберите задачу на три минуты. Для тренировки детали покупать не нужно.</p>
      <div className="training-picks">
        <button type="button" aria-pressed={puzzle === "edit"} onClick={() => setMode("edit")}>
          <TrainingSketch />
          Спасти одной правкой
        </button>
        <button type="button" aria-pressed={puzzle === "diag"} onClick={() => setMode("diag")}>
          <TrainingSketch diagnosis />
          Найти причину
        </button>
      </div>
      {puzzle === "diag" ? (
        <Diagnosis store={s} />
      ) : puzzle === "edit" ? (
        <section>
          <h2>Спасите участок B</h2>
          <p>
            {s.pack.missionDay.conditions[0]?.label} · {s.lexicon.extraRiskLabel}
          </p>
          <p>До правки: +{evaluate(s, base, 0).totalPoints} очк.</p>
          <RouteMap
            labels={[s.lexicon.sectorALabel, s.lexicon.sectorBLabel]}
            target={fix ? "B" : "A"}
            onSelect={(v) => setFix(v === "B")}
          />
          {fix && <p>После правки: +{evaluate(s, { ...base, reserveTarget: "B" }, 0).totalPoints} очк.</p>}
        </section>
      ) : null}
      <a
        className="share"
        href={"https://t.me/share/url?url=" + encodeURIComponent(share.href)}
        target="_blank"
        rel="noreferrer"
      >
        <Share2 size={18} /> Поделиться задачей
      </a>
    </>
  );
}
export function PlayerSurface3({ store: s }: Props) {
  const reduced = useReducedMotion();
  const [tried, setTried] = useState(false);
  const [story, setStory] = useState(false);
  const [practice, setPractice] = useState(false);
  const [sim, setSim] = useState(false);
  useTelegramBackButton(story || practice || s.slotSheetOpen, () => {
    if (s.slotSheetOpen) s.setSlotSheetOpen(false);
    else if (story) setStory(false);
    else setPractice(false);
  });
  const phase = s.playerPhase;
  const day = s.pack.missionDay;
  const outcome = s.dualForecast[s.revealedConditionIdx];
  if (!outcome) return null;
  return (
    <article className="player" lang="ru">
      <header>
        <button
          className="story"
          type="button"
          aria-label="Легенда и правила"
          onClick={() => setStory(!story)}
        >
          <Mark kind="team" />
        </button>
        <span>
          Команда «{s.myTeam.name}» · День {day.day}
        </span>
        {s.addons.offClassPlayground && (
          <button type="button" className="training" onClick={() => setPractice(!practice)}>
            <Mark kind="practice" />
            {practice ? "К уроку" : "Тренировка"}
          </button>
        )}
      </header>
      {story && (
        <section>
          <PackIllustration template={s.template} kind="hero" label={day.title} />
          <h2>{day.title}</h2>
          <p>
            Согласуйте пять решений. Каждый управляет своей строкой. Валюту выдаёт наставник за работу на
            занятии.
          </p>
          <button type="button" onClick={() => setStory(false)}>
            К игре
          </button>
        </section>
      )}
      <motion.div
        key={practice ? "practice" : phase}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="phase"
      >
        {practice || phase === "e5" ? (
          <Playground store={s} />
        ) : phase === "e3a" || phase === "e3b" ? (
          <Program store={s} />
        ) : phase === "e3c" ? (
          <Diagnosis store={s} lesson />
        ) : phase === "e2" ? (
          <Assembly store={s} />
        ) : phase === "e4" && s.roundResult !== "mission" ? (
          <>
            <h1>{s.roundResult === "diagnosis" ? "Результат диагностики" : "Ход по треку"}</h1>
            <p>
              {s.roundResult === "diagnosis"
                ? s.diagnosisScore === null
                  ? "Ответ не зафиксирован"
                  : "Получено очков: " + s.diagnosisScore
                : "Шаг команды: " + calculateTeamStep(s.myStats, s.myTeam.equipped, null, s.template).total}
            </p>
            <h2>Обсудите в команде</h2>
            <p>{s.roundResult === "diagnosis" ? s.pack.diagnosisDay.transferPrompt : day.transferPrompt}</p>
          </>
        ) : phase === "e4" ? (
          <>
            <section className="round-receipt">
              <p>
                <Mark kind="route" /> Итог раунда
              </p>
              <h1>{pointCount(outcome.totalPoints)}</h1>
              <span>
                {s.lexicon.environmentLabel} · {outcome.condition.label}
              </span>
            </section>
            <div className="sector-results">
              {[outcome.sectorA, outcome.sectorB].map((v, i) => (
                <div key={i === 0 ? "a" : "b"}>
                  <strong>{sectorName(i === 0 ? s.lexicon.sectorALabel : s.lexicon.sectorBLabel)}</strong>
                  <b>+{v.points}</b>
                  <ResourceMeter value={v.resource} threshold={v.threshold} />
                  <small>
                    {v.trippedCircuit
                      ? "Сработала защита от перегрузки"
                      : v.passed
                        ? `Хватило запаса: ${v.resource} из нужных ${v.threshold}`
                        : `Запас ${v.resource}, нужно ${v.threshold}`}
                  </small>
                </div>
              ))}
            </div>
            <h2>А если помочь другому участку?</h2>
            <button type="button" className="primary" aria-pressed={sim} onClick={() => setSim(!sim)}>
              {sim ? "Вернуть исходный план" : "Попробовать другой резерв"} <Mark kind="reserve" />
            </button>
            {sim && (
              <p role="status">
                В пробном плане команда получила бы {pointCount(outcome.counterfactual.altPoints)}. В зачёте
                остаётся {pointCount(outcome.totalPoints)}.
              </p>
            )}
            <h2>Обсудите с командой</h2>
            <p>{day.transferPrompt}</p>
          </>
        ) : phase === "e1" ? (
          <>
            <Route />
            <h1>{day.title.replace(/^День \d+ · /, "")}</h1>
            <PackIllustration template={s.template} kind="hero" label={day.title} />
            <h2>Задача дня</h2>
            <p>
              {s.lexicon.sectorALabel} · {day.routesA[0]?.label} от {day.routesA[0]?.min}
            </p>
            <p>
              {s.lexicon.sectorBLabel} · {day.deliveryB.label} от {day.deliveryB.min}
            </p>
            <Forecast store={s} />
            <p>
              <Clock3 size={16} /> Сборку откроет наставник
            </p>
          </>
        ) : (
          <>
            <div className="intro-cover">
              <PackIllustration
                template={s.template}
                kind="hero"
                label={s.lexicon.objectName}
                className="field-cover-image"
              />
            </div>
            <h1>Куда отправить резерв?</h1>
            <p>
              Впереди два испытания. Вы можете помочь команде в одном из них. Коснитесь участка, чтобы дать
              ему +2 к запасу.
            </p>
            <RouteMap
              target={s.onboardReserveTarget}
              labels={[s.lexicon.sectorALabel, s.lexicon.sectorBLabel]}
              onSelect={(v) => {
                s.setOnboardReserveTarget(v);
                setTried(true);
              }}
            />
            <div className="trial-result" role="status">
              <Mark kind="reserve" />
              <div>
                <strong>
                  {sectorName(
                    s.onboardReserveTarget === "A" ? s.lexicon.sectorALabel : s.lexicon.sectorBLabel,
                  )}{" "}
                  получает +2
                </strong>
                <small>
                  Пробный итог ·{" "}
                  {pointCount(
                    evaluate(s, { ...s.myTeam.orders, reserveTarget: s.onboardReserveTarget }, 1).totalPoints,
                  )}{" "}
                  при условии «{day.conditions[1]?.label}».
                </small>
              </div>
            </div>
            <button className="primary" type="button" onClick={() => s.setPlayerPhase("e1")}>
              {tried ? "Понятно, к задаче дня" : "Перейти к задаче дня"} <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </motion.div>
    </article>
  );
}
