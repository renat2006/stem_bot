import { NEUROFAUNA_TEMPLATE } from "@stem/shared";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PackIllustration } from "../../../entities/assembly/index.js";
import { PlayerGuide } from "../../../widgets/player-guide/index.js";
import { useEngine3Store } from "../model/engine3-store.js";
import {
  type DesignStyle,
  type PlayerPhaseId,
  WORLD_PACKS_3,
  type WorldKey,
} from "../model/engine3-types.js";
import { AdminSurface3 } from "./admin-surface.js";
import { AssemblyCatalog } from "./assembly-catalog.js";
import { AtlasNavigation } from "./atlas-navigation.js";
import { BoardSession } from "./board-session.js";
import { CjmSurface3 } from "./cjm-surface.js";
import { Mark } from "./field-graphics.js";
import { PlayerSurface3 } from "./player-surface.js";
import { ProjectorSurface3 } from "./projector-surface.js";
import "@fontsource-variable/manrope";
import "./design-lab.css";

const phases = {
  e0: "Вход",
  e1: "Задача дня",
  e2: "Сборка",
  e3a: "Личный выбор",
  e3b: "Переговоры",
  e3c: "Диагностика",
  e4: "Разбор",
  e5: "Тренировка без зачёта",
};
const concepts = { a: "Полевой атлас", b: "Телеметрия", c: "Мастерская", cjm: "Карта пути" };
export function DesignLabPage() {
  const s = useEngine3Store();
  const [open, setOpen] = useState(false);
  const [hallWindow, setHallWindow] = useState<Window | null>(null);
  function openHall() {
    if (hallWindow && !hallWindow.closed) {
      hallWindow.focus();
      return;
    }
    const win = window.open("", "stem-design-projector", "popup,width=1280,height=720");
    if (!win) {
      s.setSurface("projector");
      return;
    }
    win.document.title = "Табло смены";
    win.document.documentElement.lang = "ru";
    win.document.head.replaceChildren(
      ...Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'), (el) => el.cloneNode(true)),
    );
    win.document.body.style.cssText = "margin:0;padding:0;background:#142b23";
    setHallWindow(win);
  }
  useEffect(() => {
    if (!hallWindow) return;
    const closed = () => setHallWindow(null);
    hallWindow.addEventListener("pagehide", closed);
    return () => {
      hallWindow.removeEventListener("pagehide", closed);
      if (!hallWindow.closed) hallWindow.close();
    };
  }, [hallWindow]);
  const surface = s.surface === "admin" ? s.adminMode : s.surface;
  function setSurface(v: string) {
    if (v === "live" || v === "constructor") {
      s.setAdminMode(v);
      s.setSurface("admin");
    } else s.setSurface(v === "projector" ? "projector" : "player");
  }
  function phase(v: PlayerPhaseId) {
    s.setPlayerPhase(v);
    s.setProjectorMode(v === "e4" ? "reveal" : v === "e2" ? "build" : "program");
  }
  const [guideDone, setGuideDone] = useState(false);
  const params = new URLSearchParams(location.search);
  if (params.has("kit")) return <AssemblyCatalog />;
  if (params.get("design") === "1" && !params.has("lab") && !params.has("phase") && !params.has("mode"))
    return params.has("table") ? (
      <BoardSession />
    ) : (
      <main className="guidecanvas">
        <div className="guidepreview">
          {guideDone ? (
            <section className="guidehome">
              <PackIllustration
                template={NEUROFAUNA_TEMPLATE}
                kind="hero"
                label="НейроФауна"
                className="guidecover"
              />
              <h1>Команда «Рысь»</h1>
              <p>День 1 · 0 ДНК</p>
              <h2>Первое занятие</h2>
              <p>
                Выполните задание и покажите результат наставнику. Когда он начислит ДНК, команда сможет
                купить первую часть существа.
              </p>
              <button type="button" onClick={() => setGuideDone(false)}>
                Как играть
              </button>
            </section>
          ) : (
            <PlayerGuide template={NEUROFAUNA_TEMPLATE} teamName="Рысь" onDone={() => setGuideDone(true)} />
          )}
        </div>
      </main>
    );
  return (
    <div className={`lab dlab-${s.style === "cjm" ? "a" : s.style}`}>
      <AtlasNavigation store={s} onView={setSurface} onPhase={phase} />
      <button type="button" className="director-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={16} /> {open ? "Закрыть настройки" : "Настройки просмотра"}
      </button>
      <aside className={`director ${open ? "expanded" : ""}`} aria-label="Режиссёр стенда">
        <h2>Настройки просмотра</h2>
        <label>
          Направление
          <select value={s.style} onChange={(e) => s.setStyle(e.target.value as DesignStyle)}>
            {Object.entries(concepts).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Поверхность
          <select value={surface} onChange={(e) => setSurface(e.target.value)}>
            {Object.entries({
              player: "Игрок",
              live: "Пульт урока",
              constructor: "Конструктор",
              projector: "Проектор 16:9",
            }).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Смена
          <select value={s.world} onChange={(e) => s.switchWorld(e.target.value as WorldKey)}>
            {Object.values(WORLD_PACKS_3).map((w) => (
              <option key={w.key} value={w.key}>
                {w.template.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Фаза
          <select value={s.playerPhase} onChange={(e) => phase(e.target.value as PlayerPhaseId)}>
            {Object.entries(phases).map(([v, t]) => (
              <option key={v} value={v}>
                {v.toUpperCase()} · {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Телефон
          <select
            aria-label="Телефон"
            value={s.myPhoneSlot}
            onChange={(e) => {
              const slot = Number(e.target.value) as typeof s.myPhoneSlot;
              s.setMyPhoneSlot(slot);
              s.setIsCaptain(slot === 4);
            }}
          >
            {s.crewSlots.map((c) => (
              <option key={c.slotIndex} value={c.slotIndex}>
                {c.slotIndex + 1} · {c.memberName}
                {c.slotIndex === 4 ? " · капитан" : ""}
              </option>
            ))}
          </select>
        </label>
        <details>
          <summary>Условия сцены</summary>
          <label>
            Пример плана
            <select
              defaultValue="safe_3_2"
              onChange={(e) => s.applyStrategyPreset(e.target.value as "safe_3_2" | "risk_4_1")}
            >
              <option value="safe_3_2">Надёжный</option>
              <option value="risk_4_1">Рискованный</option>
            </select>
          </label>
          <label>
            Скрытая среда
            <select
              value={s.revealedConditionIdx}
              onChange={(e) => s.setRevealedConditionIdx(Number(e.target.value) as 0 | 1)}
            >
              {s.pack.missionDay.conditions.map((c, i) => (
                <option key={c.id} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </details>
      </aside>
      <main className="lab-stage">
        {s.style === "cjm" ? (
          <CjmSurface3 />
        ) : s.surface === "admin" ? (
          <AdminSurface3 store={s} openHall={openHall} />
        ) : s.surface === "projector" ? (
          <ProjectorSurface3 store={s} />
        ) : (
          <div className="field-spread">
            <aside className="mission-jacket" aria-label="Задача команды">
              <div className="jacket-brand">
                <Mark kind="team" />
                {s.template.title}
              </div>
              <div className="jacket-heading">
                <span>Задача дня {s.lessonDay}</span>
                <h2>{s.pack.missionDay.title.replace(/^День \d+ · /, "")}</h2>
              </div>
              <PackIllustration
                template={s.template}
                kind="story"
                label={s.lexicon.objectName}
                className="jacket-image"
              />
              <div className="jacket-foot">
                <Mark kind="route" />
                <p>
                  {s.lexicon.sectorALabel}
                  <br />
                  {s.lexicon.sectorBLabel}
                </p>
              </div>
            </aside>
            <div className="phone" key={s.world}>
              <PlayerSurface3 store={s} />
            </div>
          </div>
        )}
      </main>
      {hallWindow &&
        !hallWindow.closed &&
        createPortal(
          <div className={`lab projected dlab-${s.style === "cjm" ? "a" : s.style}`}>
            <ProjectorSurface3 store={s} />
          </div>,
          hallWindow.document.body,
        )}
      {s.toast && (
        <div className="lab-toast" role="status">
          {s.toast}
        </div>
      )}
    </div>
  );
}
