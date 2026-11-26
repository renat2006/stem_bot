import {
  calculateTeamStats,
  ROVER_EVENT_CELLS,
  ROVER_SPRINT_TEMPLATE,
  resolveBoardTurn,
  type Team,
} from "@stem/shared";
import {
  BellOff,
  Bot,
  Check,
  Download,
  ExternalLink,
  MessageSquare,
  Monitor,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Mark, ToggleSwitch } from "../../../shared/ui/index.js";
import "./team-guide.css";

type RoleFilter = "all" | "host" | "player";

interface GuideScreenShot {
  id: string;
  group: "player" | "host";
  title: string;
  subtitle: string;
  src: string;
}

const SCREENSHOTS: GuideScreenShot[] = [
  {
    id: "join",
    group: "player",
    title: "1. Вход в команду",
    subtitle: "Участник вводит имя и код команды со стола. Первый вошедший становится капитаном.",
    src: "/guide/guide_01_player_join.webp",
  },
  {
    id: "hangar",
    group: "player",
    title: "2. Ангар ровера",
    subtitle: "Бюджет Деталей, шаг хода, Спираль заезда, модель ровера и 6 слотов запчастей.",
    src: "/guide/guide_02_player_hangar.webp",
  },
  {
    id: "market",
    group: "player",
    title: "3. Магазин и биржа",
    subtitle: "Покупка запчастей (лимит — 2 карты в день), обмен между командами и аукцион.",
    src: "/guide/guide_03_player_market.webp",
  },
  {
    id: "board",
    group: "player",
    title: "4. Поле и правила",
    subtitle: "16 клеток Квадрата событий и Спираль 1–30. Нажатие на клетку показывает её правило и прогноз.",
    src: "/guide/guide_04_player_board.webp",
  },
  {
    id: "admin-mobile",
    group: "host",
    title: "5. Пульт ведущего на телефоне",
    subtitle: "Одна главная кнопка текущей фазы, продление таймера на 30 секунд и меню действий «⋯».",
    src: "/guide/guide_05_admin_mobile.webp",
  },
  {
    id: "broadcast",
    group: "host",
    title: "6. Сообщения командам",
    subtitle: "Отправка объявлений всем командам или одной выбранной — с готовыми шаблонами и тихим режимом.",
    src: "/guide/guide_06_admin_broadcast.webp",
  },
  {
    id: "admin-turn",
    group: "host",
    title: "7. Ввод клеток хода",
    subtitle: "Ведущий отмечает выпавшие клетки 1–16 — система сама рассчитывает шаг, откуп и награды.",
    src: "/guide/guide_07_admin_turn_desktop.webp",
  },
  {
    id: "projector",
    group: "host",
    title: "8. Табло зала 16:9",
    subtitle: "Общий экран для проектора: Квадрат событий, Спираль заезда 1–30 и прямая лента событий.",
    src: "/guide/guide_08_projector_16x9.webp",
  },
];

const DAY_FLOW = [
  {
    step: "Этап 1",
    title: "Учебные задания и Детали",
    body: "Команды выполняют практические STEM-задания занятия. Ведущий начисляет Детали за выполненные критерии.",
  },
  {
    step: "Этап 2",
    title: "Магазин запчастей",
    body: "Ведущий открывает витрину. Капитан покупает до 2 запчастей за день, усиливая характеристики ровера.",
  },
  {
    step: "Этап 3",
    title: "Ход по Квадрату событий",
    body: "Команды двигают фишку по внешнему полю на величину своего шага, проходят проверку клетки и продвигаются по Спирали 1–30.",
  },
  {
    step: "Этап 4",
    title: "Итоги и новый день",
    body: "Ведущий переводит смену на следующий день (всего 6 дней). Лимит покупок обновляется, команды готовятся к новому раунду.",
  },
] as const;

const CELL_RULES = [
  {
    cells: "1",
    name: "Старт",
    stat: "—",
    rule: "Начало внешнего круга. Без штрафов и бонусов.",
  },
  {
    cells: "2, 7",
    name: "Пит-стоп",
    stat: "Бонус",
    rule: "Команда открывает 2 карты из колоды рынка: одну забирает бесплатно, вторую сбрасывает.",
  },
  {
    cells: "3, 8, 12",
    name: "Мастерская",
    stat: "Ресурс",
    rule: "Команда получает +5 Деталей на баланс.",
  },
  {
    cells: "4, 9, 13",
    name: "Ускорение",
    stat: "Мощность",
    rule: "1–2: −1 по Спирали (откуп 5 Дет.) · 3–4: +3 Дет. · 5–7: +2 Спираль, +3 Дет. · 8+: +3 Спираль, +5 Дет.",
  },
  {
    cells: "5, 11, 15",
    name: "Завал",
    stat: "Проходимость",
    rule: "1–2: −1 по Спирали (откуп 5 Дет.) · 3–5: +1 Спираль · 6–7: +2 Спираль, +3 Дет. · 8+: +3 Спираль, +5 Дет.",
  },
  {
    cells: "6, 10, 14",
    name: "Болото",
    stat: "Скорость",
    rule: "1–2: потеря 1 Запчасти и −1 по Спирали (сохранить: 5 Дет.) · 3–4: −1 по Спирали (откуп 5 Дет.) · 5–7: +1 Спираль, +3 Дет. · 8+: +2 Спираль, +5 Дет.",
  },
  {
    cells: "16",
    name: "Апгрейд",
    stat: "Бонус",
    rule: "Бесплатная замена любых 2 запчастей на две открытые карты с рынка (по желанию команды).",
  },
] as const;

const LESSON_CHECKLIST = [
  "Открыть пульт ведущего в админском боте (/start) и проверить список команд и текущий день",
  "Вывести общее табло 16:9 на проектор в обычном браузере и развернуть на весь экран (F11)",
  "Выдать командам коды со стола — участники вводят код в клиентском боте и подключаются",
  "Провести 4 этапа дня по главной кнопке пульта: Начисление → Магазин → Ход на поле → Следующий день",
] as const;

function cellTone(label: string): string {
  if (label === "Ускорение") return "boost";
  if (label === "Мастерская") return "workshop";
  if (label === "Пит-стоп" || label === "Апгрейд") return "pitstop";
  if (label === "Завал") return "rubble";
  if (label === "Болото") return "swamp";
  return "start";
}

export function TeamGuidePage() {
  const [role, setRole] = useState<RoleFilter>("all");
  const [speed, setSpeed] = useState(3);
  const [traction, setTraction] = useState(3);
  const [payload, setPayload] = useState(4);
  const [hasElite, setHasElite] = useState(false);
  const [selectedCellPos, setSelectedCellPos] = useState(6);
  const [shotGroup, setShotGroup] = useState<"player" | "host">("player");
  const [shotId, setShotId] = useState("hangar");
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  const visibleShots = useMemo(() => SCREENSHOTS.filter((s) => s.group === shotGroup), [shotGroup]);
  const activeShot = visibleShots.find((s) => s.id === shotId) ?? visibleShots[0] ?? SCREENSHOTS[0];

  const selectedCell = ROVER_EVENT_CELLS.find((c) => c.position === selectedCellPos) ?? ROVER_EVENT_CELLS[0];

  const simResult = useMemo(() => {
    const eliteCard = ROVER_SPRINT_TEMPLATE.cards.find((c) => c.rarity === "legendary");
    const mockTeam: Team = {
      id: "sim",
      name: "Тестовый ровер",
      monogram: "Т",
      joinCode: "DEMO01",
      captainUsername: "",
      members: ["Участник"],
      currency: 10,
      heldCurrency: 0,
      trackPosition: 6,
      boardPosition: selectedCellPos,
      purchasesToday: 0,
      equippedCards: hasElite && eliteCard ? { [eliteCard.slotId]: eliteCard.id } : {},
      inventory: [],
      badges: [],
      activePerkId: null,
      statModifiers: {
        speed: speed - (hasElite && eliteCard ? (eliteCard.stats.speed ?? 0) : 0),
        traction: traction - (hasElite && eliteCard ? (eliteCard.stats.traction ?? 0) : 0),
        payload: payload - (hasElite && eliteCard ? (eliteCard.stats.payload ?? 0) : 0),
      },
    };
    const stats = calculateTeamStats(mockTeam, ROVER_SPRINT_TEMPLATE, 6);
    const turn = resolveBoardTurn({
      team: mockTeam,
      template: ROVER_SPRINT_TEMPLATE,
      leaderTrackPosition: 6,
      cellOverride: selectedCell,
      useBuyoff: false,
    });
    return { step: stats.step, turn };
  }, [speed, traction, payload, hasElite, selectedCellPos, selectedCell]);

  const showHost = role === "all" || role === "host";
  const showPlayer = role === "all" || role === "player";

  return (
    <div className="guide-page">
      <header className="guide-topbar">
        <div className="guide-topbar-inner">
          <div className="flex items-center gap-2.5">
            <Mark kind="team" />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-fg">
                Экспедиция Роверов · Полевой атлас
              </div>
              <div className="text-xs font-medium text-mu">
                Руководство по проведению игры и работе с ботами
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/guide/stem-guide.pdf"
              download="Ekspeditsiya-Roverov-Guide.pdf"
              className="atlas-primary !min-h-10 !w-auto !px-3.5 !text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Скачать PDF</span>
            </a>
            <a href="/?view=projector" className="atlas-quiet !min-h-10 !px-3 !text-xs">
              <Monitor className="h-3.5 w-3.5 text-ac" />
              <span>Табло 16:9</span>
              <ExternalLink className="h-3 w-3 text-mu" />
            </a>
          </div>
        </div>
      </header>

      <main className="guide-container">
        <section className="guide-hero">
          <div className="space-y-2.5">
            <span className="guide-kicker">Руководство по проведению</span>
            <h1 className="guide-hero-title">Экспедиция Роверов: правила игры и управление сменой</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-mu">
              Интерактивная инструкция для ведущих и участников STEM-смены: механика 16 клеток поля, сборка
              ровера, работа с двумя Telegram-ботами и запуск общего табло для зала.
            </p>
          </div>

          <div role="tablist" aria-label="Фильтр разделов руководства" className="guide-tablist">
            {(
              [
                { id: "all", label: "Все разделы" },
                { id: "host", label: "Ведущему" },
                { id: "player", label: "Участникам" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`role-tab-${item.id}`}
                aria-selected={role === item.id}
                onClick={() => {
                  setRole(item.id);
                  if (item.id === "host") {
                    setShotGroup("host");
                    setShotId("admin-mobile");
                  } else if (item.id === "player") {
                    setShotGroup("player");
                    setShotId("hangar");
                  }
                }}
                className="guide-tab"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-ln bg-sf2/60 p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-fg">
                <Bot className="h-4 w-4 text-ac" />
                <span>Админский бот</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-mu">
                Инструмент ведущего. Управление фазами дня, начисление Деталей, ввод клеток хода и отправка
                объявлений командам.
              </p>
            </div>
            <div className="rounded-2xl border border-ln bg-sf2/60 p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-fg">
                <Smartphone className="h-4 w-4 text-ac" />
                <span>Клиентский бот</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-mu">
                Личный кабинет команды на телефоне: статус ровера, сборка из 6 узлов, магазин запчастей, биржа
                и карта поля.
              </p>
            </div>
            <div className="rounded-2xl border border-ln bg-sf2/60 p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-fg">
                <Monitor className="h-4 w-4 text-ac" />
                <span>Табло зала 16:9</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-mu">
                Экран для проектора. Открывается в обычном браузере без входа в Telegram и показывает поле,
                Спираль 1–30 и лидеров.
              </p>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="sec-flow">
          <div className="guide-section-head">
            <div>
              <span className="guide-kicker">Сценарий занятия</span>
              <h2 id="sec-flow" className="atlas-h2 mt-0.5">
                Как проходит один игровой день
              </h2>
            </div>
            <span className="text-xs font-semibold text-mu">Смена длится 6 игровых дней</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DAY_FLOW.map((item) => (
              <article key={item.step} className="guide-card space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-ac">
                  {item.step}
                </span>
                <h3 className="text-sm font-extrabold text-fg">{item.title}</h3>
                <p className="text-xs leading-relaxed text-mu">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-section" aria-labelledby="sec-sim">
          <div className="guide-section-head">
            <div>
              <span className="guide-kicker">Правила и расчёт хода</span>
              <h2 id="sec-sim" className="atlas-h2 mt-0.5">
                Калькулятор шагов и 16 клеток Квадрата событий
              </h2>
            </div>
            <span className="text-xs font-semibold text-mu">
              Настройте характеристики и выберите любую клетку 1–16
            </span>
          </div>

          <div className="guide-sim-grid">
            <div className="guide-card space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-mu">
                  Характеристики ровера
                </span>
                <span className="font-mono text-2xl font-extrabold text-ac tabular-nums">
                  Шаг +{simResult.step.total}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Скорость (порог 3+)", value: speed, set: setSpeed, dot: "#eab308" },
                  { label: "Проходимость (порог 3+)", value: traction, set: setTraction, dot: "#3b82f6" },
                  { label: "Мощность (порог 4+)", value: payload, set: setPayload, dot: "#ef4444" },
                ].map((s) => (
                  <label key={s.label} className="block space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-fg">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: s.dot }}
                        />
                        {s.label}
                      </span>
                      <span className="font-mono text-sm font-extrabold tabular-nums">{s.value}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={s.value}
                      onChange={(e) => s.set(Number(e.currentTarget.value))}
                      className="w-full"
                    />
                  </label>
                ))}
              </div>

              <ToggleSwitch
                checked={hasElite}
                onChange={setHasElite}
                label="Элитная запчасть (+1)"
                description="Любая установленная элитная деталь добавляет +1 к шагу"
              />

              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-bold">
                {[
                  { label: "База +1", on: true },
                  { label: "Скорость 3+ (+1)", on: speed >= 3 },
                  { label: "Проходимость 3+ (+1)", on: traction >= 3 },
                  { label: "Мощность 4+ (+1)", on: payload >= 4 },
                  { label: "Все три ≥ 2 (+1)", on: speed >= 2 && traction >= 2 && payload >= 2 },
                  { label: "Элитная (+1)", on: hasElite },
                ].map((pill) => (
                  <span
                    key={pill.label}
                    className={`rounded-full border px-2.5 py-1 ${
                      pill.on ? "border-ac bg-ac/15 text-fg" : "border-ln bg-sf2/60 text-mu opacity-65"
                    }`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="guide-card space-y-4">
              <div className="guide-cells-grid">
                {ROVER_EVENT_CELLS.map((cell) => (
                  <button
                    key={cell.position}
                    type="button"
                    data-tone={cellTone(cell.label)}
                    aria-pressed={selectedCellPos === cell.position}
                    onClick={() => setSelectedCellPos(cell.position)}
                    className="guide-cell-btn"
                  >
                    <span className="font-mono text-[11px] font-extrabold opacity-70">{cell.position}</span>
                    <strong className="text-xs font-extrabold leading-tight">{cell.label}</strong>
                  </button>
                ))}
              </div>

              {selectedCell && (
                <div className="rounded-2xl border border-ac/30 bg-sf2/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-extrabold text-fg">
                      Клетка {selectedCell.position} · {selectedCell.label}
                    </strong>
                    <span className="inline-flex items-center gap-1 rounded-full bg-ac px-2.5 py-0.5 text-xs font-bold text-acfg">
                      <Sparkles className="h-3 w-3" />
                      Расчёт для выбранной сборки
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-mu">{selectedCell.description}</p>
                  <div className="mt-3 rounded-xl border border-ln bg-sf px-3 py-2 text-xs font-bold text-fg">
                    Результат хода: {simResult.turn.summary}
                    {simResult.turn.losePartRequired
                      ? " · команда теряет 1 запчасть (сохранить: 5 Деталей)"
                      : ""}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard-scrollable table region per responsive-table guidance */}
          <section tabIndex={0} aria-labelledby="cells-table-caption" className="guide-table-wrap">
            <table className="guide-table">
              <caption id="cells-table-caption" className="sr-only">
                Полная таблица правил 16 клеток Квадрата событий
              </caption>
              <thead>
                <tr>
                  <th>Клетки</th>
                  <th>Событие</th>
                  <th>Проверка</th>
                  <th>Эффект на Спираль (1–30) и Детали</th>
                </tr>
              </thead>
              <tbody>
                {CELL_RULES.map((row) => (
                  <tr key={row.name}>
                    <th scope="row" className="font-mono tabular-nums">
                      {row.cells}
                    </th>
                    <td data-label="Событие" className="font-bold text-fg">
                      {row.name}
                    </td>
                    <td data-label="Проверка" className="text-mu">
                      {row.stat}
                    </td>
                    <td data-label="Эффект">{row.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>

        <section className="guide-section" aria-labelledby="sec-screens">
          <div className="guide-section-head">
            <div>
              <span className="guide-kicker">Обзор экранов</span>
              <h2 id="sec-screens" className="atlas-h2 mt-0.5">
                Основные экраны участников и ведущего
              </h2>
            </div>

            <div role="tablist" aria-label="Выбор группы экранов" className="guide-tablist">
              <button
                type="button"
                role="tab"
                id="shots-tab-player"
                aria-selected={shotGroup === "player"}
                onClick={() => {
                  setShotGroup("player");
                  setShotId("hangar");
                }}
                className="guide-tab"
              >
                Экраны участника
              </button>
              <button
                type="button"
                role="tab"
                id="shots-tab-host"
                aria-selected={shotGroup === "host"}
                onClick={() => {
                  setShotGroup("host");
                  setShotId("admin-mobile");
                }}
                className="guide-tab"
              >
                Пульт ведущего и Табло 16:9
              </button>
            </div>
          </div>

          <div
            role="tabpanel"
            aria-labelledby={shotGroup === "player" ? "shots-tab-player" : "shots-tab-host"}
            className="guide-shot-stage"
          >
            <div className="space-y-2">
              {visibleShots.map((shot) => (
                <button
                  key={shot.id}
                  type="button"
                  aria-pressed={activeShot?.id === shot.id}
                  onClick={() => setShotId(shot.id)}
                  className="atlas-item-btn"
                >
                  <span>{shot.title}</span>
                  <small>{shot.subtitle}</small>
                </button>
              ))}
            </div>

            {activeShot && (
              <figure className="space-y-2.5">
                <div className="guide-shot-frame">
                  <img
                    src={activeShot.src}
                    alt={activeShot.title}
                    loading="lazy"
                    decoding="async"
                    className="guide-shot-img"
                  />
                </div>
                <figcaption className="text-center text-xs font-medium text-mu">
                  <strong className="text-fg">{activeShot.title}:</strong> {activeShot.subtitle}
                </figcaption>
              </figure>
            )}
          </div>
        </section>

        <section className="guide-section" aria-labelledby="sec-bots">
          <div className="guide-section-head">
            <div>
              <span className="guide-kicker">Работа в Telegram</span>
              <h2 id="sec-bots" className="atlas-h2 mt-0.5">
                Админский и клиентский боты на занятии
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {showHost && (
              <div className="guide-card space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-fg">
                  <MessageSquare className="h-4 w-4 text-ac" />
                  <span>Сообщения командам из админского бота</span>
                </div>
                <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-mu">
                  <li>
                    <strong className="text-fg">Напишите текст прямо в чат админ-бота</strong> — появится
                    предпросмотр с выбором: «Отправить всем», «Тихо» или «Выбрать команду».
                  </li>
                  <li>
                    <strong className="text-fg">Команда /msg или кнопка «Написать командам»</strong> — выбор
                    получателя, готовые фразы для объявлений и подтверждение числа получивших участников.
                  </li>
                  <li>
                    <strong className="text-fg">В пульте ведущего</strong> — откройте меню <code>⋯</code> и
                    нажмите «Написать командам».
                  </li>
                </ol>

                <div className="guide-tg-bubble">
                  <div className="text-xs font-extrabold text-fg">Сообщение ведущего · команда «Марс-01»</div>
                  <div className="guide-tg-quote text-xs text-fg">
                    Через 5 минут открываем магазин — подготовьте список деталей и проверьте бюджет.
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-mu">
                    <span>Ведущий</span>
                    <span className="inline-flex items-center gap-1 font-bold text-ac">
                      <BellOff className="h-3 w-3" />
                      Доступен тихий режим
                    </span>
                  </div>
                </div>
              </div>
            )}

            {showPlayer && (
              <div className="guide-card space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-fg">
                  <Users className="h-4 w-4 text-ac" />
                  <span>Клиентский бот для участников</span>
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-mu">
                  <li>
                    <strong className="text-fg">/start и /status</strong> — карточка команды: роль, баланс
                    Деталей, позиция на Спирали и кнопка перехода сразу в нужный раздел игры.
                  </li>
                  <li>
                    <strong className="text-fg">Подключение по коду</strong> — код команды со стола можно
                    отправить обычным сообщением в чат бота.
                  </li>
                  <li>
                    <strong className="text-fg">Капитан и участники</strong> — первый вошедший подтверждает
                    покупки в магазине; остальные предлагают детали, а вся сборка обновляется синхронно.
                  </li>
                  <li>
                    <strong className="text-fg">Уведомления на уроке</strong> — старт магазина, аукцион и
                    объявления ведущего приходят со звуком; начисления и итоги дня — тихо, не отвлекая класс.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {showHost && (
          <section className="guide-section" aria-labelledby="sec-check">
            <div className="guide-section-head">
              <div>
                <span className="guide-kicker">Подготовка</span>
                <h2 id="sec-check" className="atlas-h2 mt-0.5">
                  Чек-лист ведущего за 5 минут до старта
                </h2>
              </div>
            </div>
            <div className="guide-card space-y-2">
              {LESSON_CHECKLIST.map((step, idx) => {
                const done = Boolean(checkedSteps[idx]);
                return (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={done}
                    onClick={() => setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                      done
                        ? "border-ac/40 bg-ac/10 text-mu line-through"
                        : "border-ln bg-sf2/50 text-fg hover:border-ac"
                    }`}
                  >
                    <span
                      className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        done ? "border-ac bg-ac text-acfg" : "border-ln bg-sf"
                      }`}
                    >
                      {done && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span>{step}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
