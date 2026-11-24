import {
  calculateTeamStats,
  type GameTemplate,
  NEUROFAUNA_TEMPLATE,
  ROVER_SPRINT_TEMPLATE,
  resolveBoardTurn,
  type Team,
  TeamSchema,
} from "@stem/shared";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AssemblyStage, PartSticker } from "../../../entities/assembly/index.js";
import "./board-session.css";

const fauna = {
  ...NEUROFAUNA_TEMPLATE,
  stepThresholds: [
    { statId: "speed", min: 4, bonus: 1 },
    { statId: "strength", min: 6, bonus: 1 },
    { statId: "survival", min: 4, bonus: 1 },
  ],
};
const events = [
  "Старт",
  "Мутация",
  "Ресурс",
  "Охота",
  "Катастрофа",
  "Хищник",
  "Мутация",
  "Ресурс",
  "Охота",
  "Хищник",
  "Катастрофа",
  "Ресурс",
  "Охота",
  "Хищник",
  "Катастрофа",
  "Большая мутация",
];
const teams = ["Рысь", "Сокол"].map((name, i) =>
  TeamSchema.parse({
    id: String(i),
    name,
    captainUsername: "",
    currency: 0,
    trackPosition: 1,
    boardPosition: 1,
    purchasesToday: 0,
    equippedCards: {},
    activePerkId: null,
    statModifiers: {},
  }),
);
const steps = ["Правила", "Занятие", "Магазин", "Кубик", "Событие", "Итог"];
function Board({ labels, positions, spiral }: { labels: string[]; positions: Team[]; spiral: boolean }) {
  const size = Math.ceil(Math.sqrt(labels.length));
  const side = spiral ? size : Math.ceil(labels.length / 4) + 1;
  let x = 0,
    y = 0,
    dx = 1,
    dy = 0;
  const used = new Set<string>();
  return (
    <div className="fieldboard" style={{ gridTemplateColumns: `repeat(${side},1fr)` }}>
      {labels.map((label, i) => {
        const style = { gridColumn: x + 1, gridRow: y + 1 };
        used.add(`${x},${y}`);
        if (x + dx < 0 || x + dx >= side || y + dy < 0 || y + dy >= side || used.has(`${x + dx},${y + dy}`))
          [dx, dy] = [-dy, dx];
        x += dx;
        y += dy;
        return (
          <div
            className="fieldcell"
            key={`${style.gridColumn}-${style.gridRow}`}
            data-event={spiral ? undefined : label}
            style={style}
            title={label}
          >
            <b>{i + 1}</b>
            {!spiral && <small>{label}</small>}
            <span>
              {positions
                .filter((t) => (spiral ? t.trackPosition : t.boardPosition) === i + 1)
                .map((t) => (
                  <i role="img" key={t.id} data-team={t.id} aria-label={t.name}>
                    {t.name[0]}
                  </i>
                ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
export function BoardSession() {
  const [template, setTemplate] = useState<GameTemplate>(fauna);
  const [players, setPlayers] = useState(teams),
    [turn, setTurn] = useState(0),
    [day, setDay] = useState(1),
    [phase, setPhase] = useState(0);
  const [selected, select] = useState(""),
    [roll, setRoll] = useState(0),
    [history, record] = useState<string[]>([]),
    [rules, showRules] = useState(false);
  const team = players[turn] as Team,
    bio = template.id === fauna.id,
    money = template.currencyName;
  const labels = bio ? events : template.boardCells.map((c) => c.label);
  const cell = labels[team.boardPosition - 1] ?? "Старт";
  const update = (change: Partial<Team>) =>
    setPlayers(players.map((t, i) => (i === turn ? { ...t, ...change } : t)));
  const cards = template.cards.filter((c) => c.dayAvailable <= day);
  const card = cards.find((c) => c.id === selected);
  const stats = calculateTeamStats(team, template);
  const equipped =
    card && phase === 2 ? { ...team.equippedCards, [card.slotId]: card.id } : team.equippedCards;
  const preview = calculateTeamStats({ ...team, equippedCards: equipped }, template);
  const finished =
    players.some((t) => t.trackPosition >= template.trackMax) ||
    (phase === 5 && day === template.totalDays && turn === players.length - 1);
  const intro = (
    <ol>
      <li>Соберите команду у стола. Поставьте её фишки на старт поля событий и трека гонки.</li>
      <li>Выполните задание занятия. Наставник выдаст {money} на улучшения.</li>
      <li>Выберите деталь. От сборки зависит, как команда справится с событием.</li>
      <li>Бросьте кубик за столом. Приложение покажет эффект клетки и куда передвинуть фишку на треке.</li>
      <li>Побеждает первая команда на клетке {template.trackMax} или лидер после последнего дня.</li>
    </ol>
  );
  const mutation = (bio && cell.includes("мутация")) || (bio && cell === "Мутация");
  const [free, setFree] = useState(0);
  function outcome() {
    if (!bio) {
      const o = resolveBoardTurn({
        template,
        team,
        cellOverride: template.boardCells[team.boardPosition - 1],
      });
      return { cash: o.currencyDelta, bonus: o.eventTrackDelta, detail: o.summary, lose: false };
    }
    const key = cell === "Охота" ? "strength" : cell === "Катастрофа" ? "survival" : "speed";
    const value = stats.total[key] ?? 0;
    if (["Охота", "Хищник", "Катастрофа"].includes(cell)) {
      const high = value >= 8,
        mid = value >= (key === "survival" ? 6 : 5);
      const bonus = high
        ? key === "speed"
          ? 2
          : 3
        : mid
          ? key === "speed"
            ? 1
            : 2
          : value <= 2 || key === "speed"
            ? -1
            : key === "survival"
              ? 1
              : 0;
      return {
        cash: high ? 5 : mid || (key === "strength" && value >= 3) ? 3 : 0,
        bonus,
        detail: `${template.stats.find((s) => s.id === key)?.label} вашей сборки · ${value}`,
        lose: key === "speed" && value <= 2,
      };
    }
    return {
      cash: cell === "Ресурс" ? 5 : 0,
      bonus: 0,
      detail:
        cell === "Ресурс" ? "Нашли запас ДНК." : mutation ? "Измените сборку бесплатно." : "Фишка на старте.",
      lose: false,
    };
  }
  const effect = outcome(),
    base = stats.step.total + (bio && Object.values(stats.total).every((n) => n >= 1) ? 1 : 0);
  function finish(buyoff = false, lostSlot?: string) {
    const equipment = { ...team.equippedCards };
    if (lostSlot) delete equipment[lostSlot];
    const after = calculateTeamStats({ ...team, equippedCards: equipment }, template);
    const step = after.step.total + (bio && Object.values(after.total).every((n) => n >= 1) ? 1 : 0);
    const next = Math.max(
      1,
      Math.min(template.trackMax, team.trackPosition + step + (buyoff ? 0 : effect.bonus)),
    );
    update({
      equippedCards: equipment,
      currency: Math.max(0, team.currency + (buyoff ? -5 : effect.cash)),
      trackPosition: next,
    });
    record([
      `День ${day} · ${team.name} · кубик ${roll} · ${cell} · трек ${team.trackPosition} → ${next}`,
      ...history,
    ]);
    setPhase(5);
  }
  const [hall, setHall] = useState<Window | null>(null);
  useEffect(() => () => hall?.close(), [hall]);
  function openHall() {
    if (hall && !hall.closed) {
      hall.focus();
      return;
    }
    const w = window.open("", "atlas-board", "popup,width=1100,height=900");
    if (!w) return;
    w.document.title = "Гонка команд";
    document.querySelectorAll("style,link[rel=stylesheet]").forEach((el) => {
      w.document.head.appendChild(el.cloneNode(true));
    });
    setHall(w);
  }
  const table = (
    <aside className="tablepage">
      <h2>{phase === 2 || phase === 0 ? template.objectName : "Поле событий"}</h2>
      {phase === 2 || phase === 0 ? (
        <AssemblyStage template={template} equipped={equipped} teamName={team.name} />
      ) : (
        <Board labels={labels} positions={players} spiral={false} />
      )}
      <h2>{template.trackName}</h2>
      <Board
        labels={Array.from({ length: template.trackMax }, (_, i) => String(i + 1))}
        positions={players}
        spiral
      />
      <p>{players.map((t) => `${t.name} · ${t.trackPosition}`).join("　　 ")}</p>
      {history.length > 0 && (
        <details open>
          <summary>Ходы команд</summary>
          {history.map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </details>
      )}
    </aside>
  );
  return (
    <main className="boardbook">
      <header>
        <b>Полевой атлас</b>
        <button type="button" onClick={openHall}>
          Табло для зала ↗
        </button>
        <a href="?design=1&atlas=1&lab=1">Карта прототипа ↗</a>
      </header>
      <div className="boardlayout">
        <section className="playpage">
          <small>
            {template.title} / День {day} из {template.totalDays}
          </small>
          <h1>
            {
              [
                "Как играть",
                "Работа команды",
                "Мастерская",
                "Ход за столом",
                cell,
                finished ? "Финиш гонки" : "Ход завершён",
              ][phase]
            }
          </h1>
          {phase === 0 ? (
            <>
              <select
                aria-label="Тема смены"
                value={template.id}
                onChange={(e) => setTemplate(e.target.value === fauna.id ? fauna : ROVER_SPRINT_TEMPLATE)}
              >
                {[fauna, ROVER_SPRINT_TEMPLATE].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              {intro}
              <button type="button" onClick={() => setPhase(1)}>
                Начать игру
              </button>
            </>
          ) : (
            <>
              <p className="teamline">
                Команда «{team.name}» · {team.currency} {money}
              </p>
              {phase === 1 && (
                <>
                  <p>
                    Покажите наставнику результат занятия. В этой демонстрации наставник выбирает награду за
                    столом.
                  </p>
                  {[4, 6].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => {
                        update({ currency: team.currency + n, purchasesToday: 0 });
                        setPhase(2);
                      }}
                    >
                      {n === 4 ? "Выполнен минимум" : "Объяснили решение"} · +{n}
                    </button>
                  ))}
                </>
              )}
              {phase === 2 && (
                <>
                  <p>Примерьте деталь и сравните характеристики. После покупки обновите сборку на столе.</p>
                  <div className="partrow">
                    {cards.map((c) => (
                      <button
                        type="button"
                        aria-pressed={selected === c.id}
                        key={c.id}
                        onClick={() => select(c.id)}
                      >
                        <PartSticker card={c} template={template} thumbnail />
                        {c.name}
                        <small>
                          {c.price} {money}
                        </small>
                      </button>
                    ))}
                  </div>
                  <p>
                    {template.stats
                      .map((s) => `${s.label} ${stats.total[s.id] ?? 0} → ${preview.total[s.id] ?? 0}`)
                      .join(" · ")}
                  </p>
                  {card && (
                    <button
                      type="button"
                      disabled={
                        team.currency < card.price ||
                        team.purchasesToday >= (template.dailyPurchaseLimit ?? Infinity) ||
                        team.equippedCards[card.slotId] === card.id
                      }
                      onClick={() => {
                        update({
                          equippedCards: equipped,
                          currency: team.currency - card.price,
                          purchasesToday: team.purchasesToday + 1,
                        });
                        select("");
                      }}
                    >
                      Купить за {card.price} {money}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      select("");
                      setPhase(3);
                    }}
                  >
                    Перейти к полю
                  </button>
                </>
              )}
              {phase === 3 && (
                <>
                  <p>
                    Бросьте настоящий кубик и выберите выпавшее число. Передвиньте фишку по полю событий по
                    часовой стрелке.
                  </p>
                  <div className="dice">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        type="button"
                        aria-label={`Выпало ${n}`}
                        key={n}
                        onClick={() => {
                          const pos = ((team.boardPosition - 1 + n) % labels.length) + 1;
                          update({ boardPosition: pos });
                          setRoll(n);
                          setFree(labels[pos - 1] === "Большая мутация" ? 2 : 1);
                          setPhase(4);
                        }}
                      >
                        {String.fromCodePoint(0x267f + n)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {phase === 4 && (
                <>
                  <p>
                    Поле событий · клетка {team.boardPosition}. {effect.detail}
                  </p>
                  <p>
                    Шаг сборки {base} · эффект клетки {effect.bonus > 0 ? "+" : ""}
                    {effect.bonus} · награда {effect.cash} {money}
                  </p>
                  {mutation && free > 0 && (
                    <>
                      <p>Выберите часть для замены. Осталось замен: {free}.</p>
                      {cards
                        .filter((c) => team.equippedCards[c.slotId] !== c.id)
                        .slice(0, cell === "Мутация" ? 2 : undefined)
                        .map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => {
                              update({ equippedCards: { ...team.equippedCards, [c.slotId]: c.id } });
                              setFree(free - 1);
                            }}
                          >
                            {c.name}
                          </button>
                        ))}
                    </>
                  )}
                  {effect.lose && Object.values(team.equippedCards).some(Boolean) ? (
                    Object.entries(team.equippedCards)
                      .filter(([, id]) => id)
                      .map(([slot, id]) => (
                        <button type="button" key={slot} onClick={() => finish(false, slot)}>
                          Сбросить {cards.find((c) => c.id === id)?.name}
                        </button>
                      ))
                  ) : (
                    <button type="button" disabled={mutation && free > 0} onClick={() => finish()}>
                      Рассчитать ход по треку
                    </button>
                  )}
                  {bio && effect.bonus < 0 && team.currency >= 5 && (
                    <button type="button" onClick={() => finish(true)}>
                      Откупиться за 5 ДНК
                    </button>
                  )}
                </>
              )}
              {phase === 5 && (
                <>
                  <p>{history[0]}</p>
                  <p>
                    Поставьте фишку «{team.name}» на клетку <strong>{team.trackPosition}</strong> общего
                    трека. Сверьте позиции команд на столе.
                  </p>
                  {finished ? (
                    <h2>
                      Лидеры ·{" "}
                      {players
                        .filter((t) => t.trackPosition === Math.max(...players.map((p) => p.trackPosition)))
                        .map((t) => t.name)
                        .join(", ")}
                    </h2>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (turn === 1) setDay(day + 1);
                        setTurn(1 - turn);
                        setPhase(1);
                      }}
                    >
                      Передать ход · {players[1 - turn]?.name}
                    </button>
                  )}
                </>
              )}
              <button type="button" className="quiet" onClick={() => showRules(!rules)}>
                {rules ? "Свернуть правила" : "Как играть?"}
              </button>
              {rules && intro}
            </>
          )}
        </section>
        {table}
      </div>
      {hall &&
        !hall.closed &&
        createPortal(
          <main className="boardbook">
            <h1>Ход команды «{team.name}»</h1>
            <p>
              День {day} · {steps[phase]}
            </p>
            {table}
          </main>,
          hall.document.body,
        )}
      <footer>
        {steps.map((s, i) => (
          <span key={s} aria-current={phase === i ? "step" : undefined}>
            {s}
          </span>
        ))}
      </footer>
    </main>
  );
}
