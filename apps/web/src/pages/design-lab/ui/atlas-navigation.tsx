import { useEffect, useRef, useState } from "react";
import type { Engine3Store } from "../model/engine3-store.js";
import type { PlayerPhaseId } from "../model/engine3-types.js";
import { Mark } from "./field-graphics.js";

const views = { player: "Игрок", live: "Ведущий", constructor: "Конструктор", projector: "Табло" };
type View = keyof typeof views;
type Scene = { title: string; phase?: PlayerPhaseId; step?: 1 | 2 | 3 | 4; symbol: string };
const scenes: Record<View, Scene[]> = {
  player: [
    { title: "Вход в команду", phase: "e0", symbol: "flag" },
    { title: "Задача дня", phase: "e1", symbol: "map" },
    { title: "Сборка", phase: "e2", symbol: "parts" },
    { title: "Личный выбор", phase: "e3a", symbol: "dial" },
    { title: "Переговоры", phase: "e3b", symbol: "split" },
    { title: "Диагностика", phase: "e3c", symbol: "probe" },
    { title: "Разбор", phase: "e4", symbol: "finish" },
    { title: "Тренировка", phase: "e5", symbol: "practice" },
  ],
  live: [
    { title: "Оценить работу", phase: "e1", symbol: "grade" },
    { title: "Открыта сборка", phase: "e2", symbol: "parts" },
    { title: "Готовность команд", phase: "e3b", symbol: "crew" },
    { title: "Итоги урока", phase: "e4", symbol: "finish" },
  ],
  constructor: [
    { title: "Словарь смены", step: 1, symbol: "flag" },
    { title: "Расписание", step: 2, symbol: "days" },
    { title: "Детали и баланс", step: 3, symbol: "split" },
    { title: "Приглашения", step: 4, symbol: "qr" },
  ],
  projector: [
    { title: "Сборка в зале", phase: "e2", symbol: "parts" },
    { title: "Общий таймер", phase: "e3a", symbol: "dial" },
    { title: "Итоги команд", phase: "e4", symbol: "grade" },
  ],
};
const sketches: Record<string, string> = {
  flag: "M12 39V9l26 4-7 7 7 7-26-4",
  map: "M5 29l12-19 15 8 12-8v26l-12 7-15-9-12 7Z M17 10v24m15-16v25",
  parts: "m5 16 18-9 18 9-18 9Zm0 8 18 9 18-9M5 32l18 9 18-9",
  dial: "M8 34a18 18 0 1 1 32 0M24 28l10-13M8 26h5m23 0h5M24 9v5",
  split: "M7 36h7l15-24h12M15 35h26m-6-28 6 5-6 5m0 12 6 6-6 5",
  probe: "M4 26h9l5-15 8 27 6-18 4 6h8",
  finish: "m7 28 10 10 25-29M6 11h11m-11 6h7",
  practice: "m12 9 27 15-27 15Zm-6 2v26",
  grade: "M7 39h34M11 33V22h5v11m6 0V15h5v18m6 0V8h5v25",
  crew: "M7 15h7v7H7Zm14 0h7v7h-7Zm14 0h7v7h-7ZM14 29h7v7h-7Zm14 0h7v7h-7Z",
  days: "M6 12h36v29H6Zm0 10h36M15 7v10m18-10v10M13 30h9m5 0h8",
  qr: "M6 7h13v13H6Zm23 0h13v13H29ZM6 29h13v13H6Zm22 0h6v6h8v7H29Z",
};
export function AtlasNavigation({
  store: s,
  onView,
  onPhase,
}: {
  store: Engine3Store;
  onView: (v: View) => void;
  onPhase: (p: PlayerPhaseId) => void;
}) {
  const [gallery, setGallery] = useState(() => new URLSearchParams(location.search).get("atlas") === "1");
  const indexButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!gallery) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGallery(false);
        indexButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [gallery]);
  const current = s.surface === "admin" ? s.adminMode : s.surface === "projector" ? "projector" : "player";
  function visit(view: View, scene?: Scene) {
    if (s.style === "cjm") s.setStyle("a");
    onView(view);
    if (scene?.phase) onPhase(scene.phase);
    if (scene?.step) s.setConstructorStep(scene.step);
    setGallery(false);
  }
  return (
    <div className="atlas-dock">
      <div className="atlas-bar">
        <span className="atlas-wordmark">
          <Mark kind="route" />
          Полевой атлас
        </span>
        <nav aria-label="Поверхности прототипа">
          {(Object.keys(views) as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={!gallery && current === v} onClick={() => visit(v)}>
              {views[v]}
            </button>
          ))}
        </nav>
        <button
          ref={indexButton}
          className="screen-index"
          type="button"
          aria-expanded={gallery}
          onClick={() => setGallery(!gallery)}
        >
          {gallery ? "Закрыть обзор" : "Все экраны"}
        </button>
      </div>
      {gallery && (
        <section className="atlas-gallery" aria-label="Все экраны прототипа">
          <h1>Карта смены</h1>
          <a href="?design=1&kit=1">Примерить детали существа и ровера →</a>{" "}
          <a href="?design=1&table=1">Сыграть партию за столом →</a>
          {(Object.keys(views) as View[]).map((v) => (
            <section key={v}>
              <h2>{views[v]}</h2>
              <div className="atlas-scenes">
                {scenes[v].map((scene) => (
                  <button key={scene.title} type="button" onClick={() => visit(v, scene)}>
                    {s.world === "rovers" && s.style === "a" && (
                      <span className={`scene-thumb thumb-${v}`}>
                        <img
                          alt=""
                          loading="lazy"
                          src={
                            new URL(`./previews/${v}-${scene.phase ?? scene.step}.webp`, import.meta.url).href
                          }
                        />
                      </span>
                    )}
                    <span className="scene-name">
                      <svg aria-hidden="true" viewBox="0 0 48 48">
                        <path d={sketches[scene.symbol]} />
                      </svg>
                      <span>{scene.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </div>
  );
}
