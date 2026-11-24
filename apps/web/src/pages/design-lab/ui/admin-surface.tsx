import { ArrowRight, Check, Monitor, Undo2 } from "lucide-react";
import { renderSVG } from "uqr";
import { PackIllustration, PartSticker } from "../../../entities/assembly/index.js";
import type { Engine3Store } from "../model/engine3-store.js";
import {
  evaluateMissionOutcome,
  type MissionTeamOrders,
  type RoundEngineType,
  type TemplateLexicon,
} from "../model/engine3-types.js";

const fields: Partial<Record<keyof TemplateLexicon, string>> = {
  objectName: "Объект",
  currencyLabel: "Валюта",
  reserveLabel: "Резерв",
  environmentLabel: "Среда",
  circuitLabel: "Контур",
  extraRiskLabel: "Риск",
  sectorALabel: "Участок A",
  sectorBLabel: "Участок B",
};
function Balance({ store: s }: { store: Engine3Store }) {
  const r = s.baseDay.routesA[0];
  if (!r) return null;
  const score = (min: number) => {
    const day = {
      ...s.baseDay,
      routesA: s.baseDay.routesA.map((v, i) => (i === 0 ? { ...v, min } : v)),
    };
    const plans: MissionTeamOrders[] = [
      { routeId: "short", paceA: "normal", paceB: "normal", extraCargo: false, reserveTarget: "A" },
      { routeId: "detour", paceA: "normal", paceB: "normal", extraCargo: true, reserveTarget: "B" },
    ];
    return plans.map((orders) =>
      day.conditions.map(
        (condition) =>
          evaluateMissionOutcome({
            day,
            condition,
            orders,
            stats: s.myStats,
            circuit: s.circuitConfig,
            equippedLoad: s.equippedLoad,
            totalWeight: day.conditions.reduce((n, c) => n + c.weight, 0),
          }).totalPoints,
      ),
    );
  };
  const bad = (v: number[][]) =>
    v.some((plan, i) =>
      v.some(
        (other, j) =>
          i !== j && other.every((n, k) => n >= (plan[k] ?? 0)) && other.some((n, k) => n > (plan[k] ?? 0)),
      ),
    );
  const min = s.paretoDay3Fixed ? r.min : r.min + 1;
  const scores = score(min);
  return (
    <section>
      <h2>День 3 · проверка двух стратегий</h2>
      <p>Контрольная сборка · порог короткого пути {min}</p>
      <div className="strategy-chart">
        {scores.map((values, i) => (
          <div key={i === 0 ? "short" : "risk"}>
            <strong>{i === 0 ? "Короткий путь" : "Дополнительный риск"}</strong>
            {values.map((points, j) => (
              <div className="strategy-bar" key={s.baseDay.conditions[j]?.id}>
                <span>{s.baseDay.conditions[j]?.label}</span>
                <i
                  style={{
                    width: `${(Math.max(1, points) * 100) / (Math.max(1, ...scores.flat()) + 1)}%`,
                    opacity: points === 0 ? 0 : 1,
                  }}
                />
                <b>{points} очк.</b>
              </div>
            ))}
          </div>
        ))}
      </div>
      {bad(scores) ? (
        <>
          <p>
            Одна стратегия даёт столько же или больше очков при любых условиях. Командам выгодно всегда
            выбирать её.
          </p>
          {!bad(score(r.min)) && (
            <button type="button" onClick={() => s.setParetoDay3Fixed(true)}>
              Снизить порог до {r.min}
            </button>
          )}
        </>
      ) : (
        <p>
          <Check /> У каждого плана есть преимущество.
        </p>
      )}
    </section>
  );
}
export function AdminSurface3({ store: s, openHall }: { store: Engine3Store; openHall: () => void }) {
  const step = s.constructorStep;
  const go = (v: typeof s.playerPhase) => {
    s.setPlayerPhase(v);
    s.setProjectorMode(v === "e4" ? "reveal" : v === "e2" ? "build" : "program");
  };
  const next =
    s.playerPhase === "e2"
      ? s.engine === "legacy_track"
        ? "e4"
        : s.engine === "diagnosis"
          ? "e3c"
          : "e3a"
      : s.playerPhase.startsWith("e3")
        ? "e4"
        : "e2";
  if (s.adminMode === "live")
    return (
      <article className="studio">
        <header>
          <span>
            День {s.lessonDay} · {s.template.title}
          </span>
          <button type="button" onClick={openHall}>
            <Monitor /> На проектор
          </button>
        </header>
        <h1>Пульт урока</h1>
        <section className="live-action">
          <div>
            <h2>
              {s.playerPhase === "e2"
                ? "Сборка"
                : s.playerPhase.startsWith("e3")
                  ? "Решения команд"
                  : s.playerPhase === "e4"
                    ? "Разбор"
                    : "Задача дня"}
            </h2>
            <p>
              {s.teams.reduce((n, t) => n + t.readyPhones, 0)} из 50 готовы ·{" "}
              {Math.floor(s.phaseSeconds / 60)}:{String(s.phaseSeconds % 60).padStart(2, "0")}
            </p>
          </div>
          <button type="button" className="primary" onClick={() => go(next)}>
            {next === "e2" ? "Открыть сборку" : next === "e4" ? "Показать итоги" : "Запустить раунд"}
            <ArrowRight />
          </button>
        </section>
        {s.playerPhase === "e4" && <p>{s.pack.missionDay.transferPrompt}</p>}
        {s.phaseSeconds > 0 && (
          <details>
            <summary>Управление таймером</summary>
            <button type="button" onClick={s.extendPhase}>
              Добавить 30 секунд
            </button>
          </details>
        )}
        {s.playerPhase.startsWith("e3") && (
          <section className="room-strip">
            <h2>Кто уже выбрал</h2>
            <div>
              {s.teams.map((t) => (
                <figure key={t.id}>
                  <div
                    className="crew-readiness"
                    role="img"
                    aria-label={`Готовы ${t.readyPhones} из ${t.totalPhones}`}
                  >
                    {s.crewSlots.map((c) => (
                      <i key={c.memberName} data-ready={c.slotIndex < t.readyPhones} />
                    ))}
                  </div>
                  <figcaption>{t.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
        <h2>Работа на занятии</h2>
        <table>
          <thead>
            <tr>
              <th>Команда</th>
              {(["Результат", "Замер"] as const).map((label, i) => (
                <th key={label}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      aria-label={label + " всем командам"}
                      checked={s.teams.every((t) => s.scoreChecks[t.id]?.[i])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        s.setScoreChecks((prev) =>
                          Object.fromEntries(
                            s.teams.map((t) => {
                              const row: [boolean, boolean] = [...(prev[t.id] ?? [false, false])];
                              row[i] = checked;
                              return [t.id, row];
                            }),
                          ),
                        );
                      }}
                    />
                    {label} +2
                  </label>
                </th>
              ))}
              <th>Бюджет</th>
            </tr>
          </thead>
          <tbody>
            {s.teams.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.name}</strong>
                  <div
                    className="crew-readiness"
                    aria-label={`Готовы ${t.readyPhones} из ${t.totalPhones}`}
                    role="img"
                  >
                    {s.crewSlots.map((c) => (
                      <i key={c.memberName} data-ready={c.slotIndex < t.readyPhones} />
                    ))}
                  </div>
                </td>
                {[0, 1].map((i) => (
                  <td key={i}>
                    <input
                      type="checkbox"
                      aria-label={t.name + (i ? " замер" : " результат")}
                      checked={!!s.scoreChecks[t.id]?.[i]}
                      onChange={() =>
                        s.setScoreChecks((prev) => {
                          const v: [boolean, boolean] = [...(prev[t.id] ?? [false, false])];
                          v[i] = !v[i];
                          return { ...prev, [t.id]: v };
                        })
                      }
                    />
                  </td>
                ))}
                <td>{t.budget}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="primary"
          disabled={!!s.rewardUndoSnap}
          onClick={s.awardMentorCriteria}
        >
          Начислить отмеченным
        </button>
        {s.rewardUndoSnap && (
          <button type="button" onClick={s.undoMentorAward}>
            <Undo2 /> Отменить начисление
          </button>
        )}
      </article>
    );
  return (
    <article className="studio">
      <header>Подготовка смены · {s.template.title}</header>
      <h1>Конструктор смены</h1>
      <nav>
        {(["Словарь", "Дни", "Каталог", "Запуск"] as const).map((n, i) => (
          <button
            type="button"
            key={n}
            aria-pressed={step === i + 1}
            onClick={() => s.setConstructorStep((i + 1) as typeof step)}
          >
            {i + 1}. {n}
          </button>
        ))}
      </nav>
      {step === 1 ? (
        <div className="editor-grid">
          <section>
            <h2>Словарь смены</h2>
            {Object.entries(fields).map(([f, l]) => (
              <label key={f}>
                {l}
                <input
                  value={s.lexicon[f as keyof TemplateLexicon]}
                  onChange={(e) => s.updateLexiconField(f as keyof TemplateLexicon, e.target.value)}
                />
              </label>
            ))}
          </section>
          <section className="preview">
            <small>На телефоне участника</small>
            <PackIllustration
              template={s.template}
              label={s.lexicon.objectName}
              kind="hero"
              className="studio-cover"
            />
            <h2>{s.lexicon.objectName}</h2>
            <p>
              {s.lexicon.currencyLabel} · {s.myTeam.budget}
            </p>
            <p>
              {s.lexicon.reserveLabel} → {s.lexicon.sectorALabel}
            </p>
            <p>{s.lexicon.environmentLabel}</p>
          </section>
        </div>
      ) : step === 2 ? (
        <>
          <h2>Расписание</h2>
          <label>
            Длительность смены
            <select
              value={s.daySchedule.length}
              onChange={(e) => {
                const days = Number(e.target.value);
                s.setDaySchedule(
                  Array.from(
                    { length: days },
                    (_, i) => s.daySchedule[i] ?? { day: i + 1, engine: "mission" },
                  ),
                );
                s.setLessonDay(Math.min(s.lessonDay, days));
              }}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} дн.
                </option>
              ))}
            </select>
          </label>
          <div className="atlas-days">
            {s.daySchedule.map((d, i) => (
              <label key={d.day}>
                День {d.day}
                <select
                  value={d.engine}
                  onChange={(e) =>
                    s.setDaySchedule(
                      s.daySchedule.map((v, j) =>
                        i === j ? { ...v, engine: e.target.value as RoundEngineType } : v,
                      ),
                    )
                  }
                >
                  <option value="mission">Миссия</option>
                  <option value="diagnosis">Диагностика</option>
                  <option value="legacy_track">Трек</option>
                </select>
              </label>
            ))}
          </div>
          <h2>Дополнения</h2>
          {Object.entries({
            powerCircuit: "Контур нагрузки",
            actionTags: "Особые маршруты",
            offClassPlayground: "Тренировка без зачёта",
            openMilestones: "Открытые вехи",
          }).map(([k, t]) => (
            <label className="toggle" key={k}>
              <input
                type="checkbox"
                checked={s.addons[k as keyof typeof s.addons]}
                onChange={(e) => s.setAddons({ ...s.addons, [k]: e.target.checked })}
              />
              {t}
            </label>
          ))}
        </>
      ) : step === 3 ? (
        <>
          <Balance store={s} />
          <details>
            <summary>Каталог · {s.template.cards.length} деталей</summary>
            {s.template.cards.map((c) => (
              <div className="catalog" key={c.id}>
                <PartSticker template={s.template} card={c} thumbnail />
                <span>
                  {c.name}
                  <small>
                    {Object.entries(c.stats)
                      .map(
                        ([id, v]) =>
                          (v >= 0 ? "Даёт " : "Платит ") +
                          Math.abs(v) +
                          " " +
                          s.template.stats.find((x) => x.id === id)?.label,
                      )
                      .join(" · ")}{" "}
                    {s.pack.cardTags[c.id]?.badgeLabel}
                  </small>
                </span>
                <label>
                  Цена
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={c.price}
                    onChange={(e) =>
                      s.setCatalog((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], price: Math.max(0, Math.min(99, Number(e.target.value))) },
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </details>
        </>
      ) : (
        <>
          <h2>Вход команд</h2>
          <label>
            День для репетиции
            <select value={s.lessonDay} onChange={(e) => s.setLessonDay(Number(e.target.value))}>
              {s.daySchedule.map((d) => (
                <option key={d.day} value={d.day}>
                  День {d.day}
                </option>
              ))}
            </select>
          </label>
          <div className="qr-grid">
            {s.teams.map((t) => {
              const url = new URL(location.href);
              url.search = new URLSearchParams({
                design: "1",
                phase: "e0",
                world: s.world,
                team: t.code,
              }).toString();
              return (
                <figure key={t.id}>
                  <img
                    alt={"QR " + t.name}
                    src={"data:image/svg+xml," + encodeURIComponent(renderSVG(url.href))}
                  />
                  <figcaption>
                    {t.name} · {t.code}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <button type="button" onClick={() => window.print()}>
            Печать QR
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              s.setDryRun(true);
              go("e2");
              s.setSurface("player");
            }}
          >
            Пройти тестовый раунд
          </button>
        </>
      )}
      {step < 4 && (
        <button
          type="button"
          className="primary"
          onClick={() => s.setConstructorStep((step + 1) as typeof step)}
        >
          Дальше <ArrowRight />
        </button>
      )}
    </article>
  );
}
