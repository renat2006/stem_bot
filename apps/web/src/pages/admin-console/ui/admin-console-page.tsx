import { resolveBoardTurn, resolveDayEngine, resolveLexicon, usesPhysicalBoard } from "@stem/shared";
import {
  BookOpen,
  ChevronRight,
  Ellipsis,
  MessageSquare,
  Monitor,
  Plus,
  Settings,
  Undo2,
} from "lucide-react";
import { useRef, useState } from "react";
import type { GameSnapshot } from "../../../entities/game/index.js";
import {
  applyTurn,
  extendPhaseTimer,
  nextDay,
  revealMissionRound,
  ShiftControls,
  setPhase,
  startRoundEngine,
  TemplateSwitcher,
} from "../../../features/control-shift/index.js";
import { RewardPanel, rewardTeams, undoRewardBatch } from "../../../features/manage-team/index.js";
import { type RunAction, useCountdown, useTelegram } from "../../../shared/lib/index.js";
import { EventFeed } from "../../../widgets/event-feed/index.js";
import { TeamsBoard } from "../../../widgets/teams-board/index.js";
import { AtlasConstructor } from "./atlas-constructor.js";
import { BriefingEditor } from "./briefing-editor.js";
import { BroadcastSheet } from "./broadcast-sheet.js";
import { CardsStudioTab } from "./cards-studio-tab.js";
import { MechanicsTab } from "./mechanics-tab.js";
import { ShiftWizardSheet } from "./shift-wizard.js";

type StudioMode = "live" | "constructor";
type AdminTab = "round" | "cards" | "balance" | "teams";

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "round", label: "Раунд" },
  { id: "cards", label: "Карты" },
  { id: "balance", label: "Баланс" },
  { id: "teams", label: "Команды" },
];

interface AdminConsolePageProps {
  snapshot: GameSnapshot;
  clockOffsetMs: number;
  run: RunAction;
  onOpenSettings?: () => void;
}

function initialStudioMode(): StudioMode {
  if (typeof window === "undefined") return "live";
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "constructor" ? "constructor" : "live";
}

function initialWizardState(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("tab") === "wizard";
}

export function AdminConsolePage({ snapshot, clockOffsetMs, run, onOpenSettings }: AdminConsolePageProps) {
  const { template, gameState, teams } = snapshot;
  const { hapticTap } = useTelegram();
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const [studioMode, setStudioMode] = useState<StudioMode>(initialStudioMode);
  const [tab, setTab] = useState<AdminTab>("round");
  const [wizardOpen, setWizardOpen] = useState(initialWizardState);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const toolsMenu = useRef<HTMLDetailsElement>(null);
  const closeTools = () => toolsMenu.current?.removeAttribute("open");
  const [fastChecks, setFastChecks] = useState<Record<string, [boolean, boolean]>>({});

  const countdown = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const criticalAlerts = snapshot.liveBalance.alerts.filter((a) => a.severity !== "info").length;

  const dayEngine = gameState.roundEngine ?? resolveDayEngine(template, gameState.currentDay);
  const physical = usesPhysicalBoard(template, dayEngine);
  const [boardDraft, setBoardDraft] = useState<{
    day: number;
    event: string;
    positions: Record<string, number>;
    buyoffs: string[];
  } | null>(null);
  const savedDraft =
    boardDraft?.day === gameState.currentDay && boardDraft.event === snapshot.eventId ? boardDraft : null;
  const boardPositions = savedDraft?.positions ?? {};
  const buyoffTeamIds = savedDraft?.buyoffs ?? [];
  const saveBoardDraft = (positions: Record<string, number>, buyoffs: string[]) =>
    setBoardDraft({ day: gameState.currentDay, event: snapshot.eventId, positions, buyoffs });
  const physicalFinished =
    physical &&
    gameState.currentPhase === "summary" &&
    (gameState.currentDay === template.totalDays || teams.some((t) => t.trackPosition >= template.trackMax));
  const roundMode = gameState.roundMode ?? "idle";
  const readyPhones = teams.reduce((sum, t) => sum + (t.roundState?.readySlots.length ?? 0), 0);
  const maxPhones = Math.max(5, teams.length * 5);

  const openProjector = () => {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("view", "projector");
    const devAs = new URLSearchParams(window.location.search).get("as");
    if (!snapshot.viewer.isProduction && devAs) url.searchParams.set("as", devAs);
    window.open(url.toString(), "_blank", "noopener");
  };

  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const handlePrimaryLiveAction = async () => {
    if (gameState.currentPhase === "scoring") {
      await run(() => setPhase("market", 15));
      return;
    }
    if (gameState.currentPhase === "market") {
      if (dayEngine === "legacy_track") {
        await run(() => setPhase("turn", null));
      } else {
        await run(() =>
          startRoundEngine({
            engine: dayEngine === "diagnosis" ? "diagnosis" : "mission",
            durationSeconds: dayEngine === "diagnosis" ? 180 : 120,
          }),
        );
      }
      return;
    }
    if (gameState.currentPhase === "turn" && roundMode !== "revealed") {
      if (dayEngine === "legacy_track") {
        await run(() =>
          applyTurn(
            gameState.currentDay,
            physical ? buyoffTeamIds : undefined,
            physical ? boardPositions : undefined,
          ),
        );
      } else if (dayEngine === "diagnosis") {
        await run(() => setPhase("summary", null));
      } else {
        await run(() => revealMissionRound());
      }
      return;
    }
    if (gameState.currentDay < template.totalDays) {
      await run(() => nextDay(gameState.currentDay));
    } else {
      await run(() => setPhase("scoring", null));
    }
  };

  const primaryActionLabel = physicalFinished
    ? "Партия завершена"
    : gameState.currentPhase === "scoring"
      ? "Открыть мастерскую (15 мин)"
      : gameState.currentPhase === "market"
        ? dayEngine === "diagnosis"
          ? "Запустить раунд диагностики (3:00)"
          : dayEngine === "legacy_track"
            ? "Перейти к ходу на поле"
            : "Запустить программу экипажей (2:00)"
        : gameState.currentPhase === "turn" && roundMode !== "revealed"
          ? dayEngine === "legacy_track"
            ? "Применить ход по треку"
            : dayEngine === "diagnosis"
              ? "Завершить диагностику и подвести итоги"
              : `Вскрыть условие (${lexicon.environmentLabel})`
          : gameState.currentDay < template.totalDays
            ? `Открыть День ${gameState.currentDay + 1}`
            : "Вернуться к оценке";

  const handleFastBatchAward = async () => {
    const twoIds: string[] = [];
    const fourIds: string[] = [];
    for (const t of teams) {
      const c = fastChecks[t.id] ?? [false, false];
      const pts = (c[0] ? 2 : 0) + (c[1] ? 2 : 0);
      if (pts === 2) twoIds.push(t.id);
      if (pts === 4) fourIds.push(t.id);
    }
    if (twoIds.length === 0 && fourIds.length === 0) return;
    await run(async () => {
      let lastRes = null;
      if (twoIds.length > 0) {
        lastRes = await rewardTeams(twoIds, 2, "Критерии занятия (+2)");
      }
      if (fourIds.length > 0) {
        lastRes = await rewardTeams(fourIds, 4, "Результат и замер (+4)");
      }
      setFastChecks({});
      return lastRes;
    });
  };

  const hasAnyFastCheck = teams.some((t) => {
    const c = fastChecks[t.id];
    return Boolean(c?.[0] || c?.[1]);
  });

  return (
    <article className="atlas-studio">
      <header className="atlas-studio-header">
        <div className="min-w-0">
          <div className="text-sm font-extrabold tracking-tight text-fg">Студия ведущего</div>
          <div className="mt-0.5 text-xs font-medium text-mu">
            День {gameState.currentDay} из {template.totalDays} · {template.title}
          </div>
        </div>

        <div className="atlas-studio-modes">
          <select
            className="studio-mobile-nav"
            aria-label="Раздел студии"
            value={studioMode === "constructor" ? "constructor" : tab}
            onChange={(event) => {
              const section = event.currentTarget.value;
              hapticTap();
              setStudioMode(section === "constructor" ? "constructor" : "live");
              const selected = ADMIN_TABS.find((item) => item.id === section);
              if (selected) setTab(selected.id);
            }}
          >
            {ADMIN_TABS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === "round" ? "Пульт урока" : item.label}
                {item.id === "balance" && criticalAlerts > 0 ? " · есть замечания" : ""}
              </option>
            ))}
            <option value="constructor">Конструктор смены</option>
          </select>
          <div className="atlas-segmented">
            <button
              type="button"
              aria-pressed={studioMode === "live"}
              onClick={() => {
                hapticTap();
                setStudioMode("live");
              }}
            >
              Пульт урока
            </button>
            <button
              type="button"
              aria-pressed={studioMode === "constructor"}
              onClick={() => {
                hapticTap();
                setStudioMode("constructor");
              }}
            >
              Конструктор смены
            </button>
          </div>

          <details className="atlas-studio-tools" ref={toolsMenu}>
            <summary className="atlas-icon-btn" aria-label="Действия смены" title="Действия смены">
              <Ellipsis className="h-5 w-5" />
            </summary>
            <div className="atlas-studio-tool-list">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  closeTools();
                  setWizardOpen(true);
                }}
                className="atlas-quiet text-xs"
              >
                <Plus className="h-3.5 w-3.5 text-ac" />
                <span>Новая смена</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  closeTools();
                  setBroadcastOpen(true);
                }}
                className="atlas-quiet text-xs"
              >
                <MessageSquare className="h-3.5 w-3.5 text-ac" />
                <span>Написать командам</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeTools();
                  openProjector();
                }}
                className="atlas-quiet text-xs"
              >
                <Monitor className="h-3.5 w-3.5 text-ac" />
                <span>Табло 16:9</span>
              </button>

              <a
                href="/guide"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeTools}
                className="atlas-quiet text-xs"
              >
                <BookOpen className="h-3.5 w-3.5 text-ac" />
                <span>Гайд и PDF</span>
              </a>

              {onOpenSettings && (
                <button
                  type="button"
                  aria-label="Настройки отображения"
                  onClick={() => {
                    closeTools();
                    onOpenSettings();
                  }}
                  className="atlas-quiet text-xs"
                >
                  <Settings className="h-4 w-4" /> Настройки
                </button>
              )}
            </div>
          </details>
        </div>
      </header>

      {studioMode === "constructor" ? (
        <AtlasConstructor
          snapshot={snapshot}
          run={run}
          onOpenCardsTab={() => {
            setStudioMode("live");
            setTab("cards");
          }}
          onSwitchToLive={() => {
            setStudioMode("live");
            setTab("round");
          }}
        />
      ) : (
        <div className="atlas-studio-content">
          <nav aria-label="Разделы студии ведущего" className="atlas-pills">
            {ADMIN_TABS.map((item) => {
              const hasAlert = item.id === "balance" && criticalAlerts > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={tab === item.id}
                  onClick={() => {
                    hapticTap();
                    setTab(item.id);
                  }}
                >
                  {item.label}
                  {hasAlert && (
                    <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warn" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </nav>

          {tab === "round" && (
            <div className="atlas-round-content">
              <h1 className="sr-only">Пульт урока</h1>

              <section className="live-action-plate">
                <div>
                  <h2 className="atlas-h2">
                    {gameState.currentPhase === "market"
                      ? "Магазин открыт"
                      : gameState.currentPhase === "turn"
                        ? physical
                          ? "Ход на поле"
                          : "Решения команд"
                        : gameState.currentPhase === "summary"
                          ? "Разбор итогов"
                          : "Начисление за занятие"}
                  </h2>
                  <p className="mt-1 text-sm text-mu tabular-nums">
                    {gameState.currentPhase === "turn"
                      ? physical
                        ? `Клетки записаны: ${teams.filter((t) => boardPositions[t.id]).length} из ${teams.length}`
                        : `${readyPhones} из ${maxPhones} пультов готовы`
                      : gameState.currentPhase === "scoring"
                        ? "Отметьте работу команд перед открытием магазина"
                        : gameState.currentPhase === "market"
                          ? "Команды выбирают детали"
                          : "Результаты доступны на табло"}
                    {gameState.phaseEndsAt
                      ? ` · ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {gameState.phaseEndsAt && (
                    <button
                      type="button"
                      onClick={() => void run(() => extendPhaseTimer(30))}
                      className="atlas-quiet text-xs"
                    >
                      +30 сек
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (pending.current) return;
                      pending.current = true;
                      setSubmitting(true);
                      try {
                        await handlePrimaryLiveAction();
                      } finally {
                        pending.current = false;
                        setSubmitting(false);
                      }
                    }}
                    disabled={
                      submitting ||
                      physicalFinished ||
                      (physical &&
                        gameState.currentPhase === "turn" &&
                        (teams.length === 0 || teams.some((t) => !boardPositions[t.id])))
                    }
                    className="atlas-primary !w-auto"
                  >
                    <span>{primaryActionLabel}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              {physical && gameState.currentPhase === "turn" && (
                <section className="space-y-3 rounded-xl border border-ln bg-sf p-4">
                  <h2 className="atlas-h2">Клетки с физического поля</h2>
                  <p className="text-sm text-mu">
                    Каждая команда бросает кубик и двигает фишку по Квадрату событий. Запишите, куда она
                    попала. После расчёта команды передвинут свои фишки на Спирали.
                  </p>
                  {teams.map((t) => {
                    const selectedCell = template.boardCells.find((c) => c.position === boardPositions[t.id]);
                    const leaderPos = teams.reduce((max, item) => Math.max(max, item.trackPosition), 1);
                    const preview = selectedCell
                      ? resolveBoardTurn({
                          team: t,
                          template,
                          leaderTrackPosition: leaderPos,
                          cellOverride:
                            selectedCell.type === "mutation"
                              ? { ...selectedCell, type: "start" }
                              : selectedCell,
                          useBuyoff: buyoffTeamIds.includes(t.id),
                        })
                      : null;
                    return (
                      <div key={t.id} className="space-y-1.5 rounded-xl border border-ln bg-sf2/55 p-3">
                        <label className="grid gap-1 text-sm font-bold">
                          <span className="flex items-center justify-between gap-2">
                            <span>{t.name}</span>
                            <span className="text-xs font-semibold text-mu tabular-nums">
                              {t.currency} {lexicon.currencyUnit} · Спираль {t.trackPosition}/
                              {template.trackMax}
                            </span>
                          </span>
                          <select
                            className="min-h-11 w-full rounded-lg border border-ln bg-sf px-2.5 font-semibold"
                            value={boardPositions[t.id] ?? ""}
                            onChange={(e) =>
                              saveBoardDraft(
                                { ...boardPositions, [t.id]: Number(e.target.value) },
                                buyoffTeamIds.filter((id) => id !== t.id),
                              )
                            }
                          >
                            <option value="">Выберите клетку (1–{template.boardCells.length})</option>
                            {template.boardCells.map((c) => (
                              <option key={c.position} value={c.position}>
                                {c.position}. {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedCell && preview && (
                          <div className="rounded-lg bg-sf px-2.5 py-2 text-xs text-fg">
                            <p className="font-bold">
                              Спираль: {t.trackPosition} до {preview.nextTrackPosition} (шаг +
                              {preview.stepMove}
                              {preview.eventTrackDelta !== 0
                                ? `, клетка ${preview.eventTrackDelta > 0 ? `+${preview.eventTrackDelta}` : preview.eventTrackDelta}`
                                : ""}
                              )
                              {preview.currencyDelta !== 0
                                ? ` · ${preview.currencyDelta > 0 ? `+${preview.currencyDelta}` : preview.currencyDelta} ${template.currencyName}`
                                : ""}
                            </p>
                            <p className="mt-0.5 text-mu">
                              {selectedCell.type === "mutation"
                                ? (selectedCell.description ?? "Розыгрыш карт рынка за столом.")
                                : preview.summary}
                            </p>
                          </div>
                        )}
                        {template.features.allowBuyoff && preview?.canBuyoff && (
                          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-fg">
                            <input
                              type="checkbox"
                              checked={buyoffTeamIds.includes(t.id)}
                              onChange={(e) =>
                                saveBoardDraft(
                                  boardPositions,
                                  e.target.checked
                                    ? [...buyoffTeamIds, t.id]
                                    : buyoffTeamIds.filter((id) => id !== t.id),
                                )
                              }
                            />
                            Откуп за {selectedCell?.buyoffCost ?? template.extraModule?.buyoffCost ?? 2}{" "}
                            {template.currencyName}
                          </label>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
              {(roundMode === "blind_draft" || roundMode === "negotiation" || roundMode === "diagnosis") && (
                <section className="room-strip space-y-2.5">
                  <h2 className="atlas-h2">Кто уже выбрал</h2>
                  <div>
                    {teams.map((t) => {
                      const readyCount = t.roundState?.readySlots.length ?? 0;
                      return (
                        <figure key={t.id}>
                          <div className="crew-readiness" role="img" aria-label={`Готовы ${readyCount} из 5`}>
                            {[0, 1, 2, 3, 4].map((idx) => (
                              <i key={idx} data-ready={Boolean(t.roundState?.readySlots.includes(idx))} />
                            ))}
                          </div>
                          <figcaption>{t.name}</figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </section>
              )}

              {teams.length > 0 && (
                <details
                  className="atlas-grading"
                  key={gameState.currentPhase}
                  open={gameState.currentPhase === "scoring"}
                >
                  <summary className="font-bold">Работа команд · {lexicon.currencyLabel}</summary>
                  <div className="space-y-3">
                    <section
                      aria-label="Таблица оценки команд"
                      className="atlas-table-region atlas-grading-table"
                    >
                      <table>
                        <thead>
                          <tr className="border-b border-ln text-left text-sm font-bold text-fg">
                            <th className="py-2.5 pr-3 pl-4">Команда</th>
                            {(["Результат +2", "Замер +2"] as const).map((colLabel, colIdx) => (
                              <th key={colLabel} className="px-2 py-2.5">
                                <label className="inline-flex cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={teams.every((t) => Boolean(fastChecks[t.id]?.[colIdx]))}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setFastChecks((prev) =>
                                        Object.fromEntries(
                                          teams.map((t) => {
                                            const row: [boolean, boolean] = [
                                              ...(prev[t.id] ?? [false, false]),
                                            ];
                                            row[colIdx] = checked;
                                            return [t.id, row];
                                          }),
                                        ),
                                      );
                                    }}
                                  />
                                  <span>{colLabel}</span>
                                </label>
                              </th>
                            ))}
                            <th className="py-2.5 pr-4 pl-2 text-right">Бюджет</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ln text-sm">
                          {teams.map((t) => {
                            const rowChecks = fastChecks[t.id] ?? [false, false];
                            return (
                              <tr key={t.id}>
                                <td className="py-2.5 pr-3 pl-4">
                                  <strong className="font-bold text-fg">{t.name}</strong>
                                </td>
                                {[0, 1].map((colIdx) => (
                                  <td key={colIdx} className="px-2 py-2.5">
                                    <label className="atlas-team-checkbox">
                                      <input
                                        type="checkbox"
                                        aria-label={`${t.name} ${colIdx === 0 ? "результат" : "замер"}`}
                                        checked={Boolean(rowChecks[colIdx])}
                                        onChange={() =>
                                          setFastChecks((prev) => {
                                            const nextRow: [boolean, boolean] = [
                                              ...(prev[t.id] ?? [false, false]),
                                            ];
                                            nextRow[colIdx] = !nextRow[colIdx];
                                            return { ...prev, [t.id]: nextRow };
                                          })
                                        }
                                      />
                                    </label>
                                  </td>
                                ))}
                                <td className="py-2.5 pr-4 pl-2 text-right font-mono font-bold text-fg tabular-nums">
                                  {t.currency}{" "}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </section>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={!hasAnyFastCheck}
                        onClick={() => void handleFastBatchAward()}
                        className="atlas-primary !w-auto"
                      >
                        Начислить отмеченным
                      </button>

                      {gameState.canUndoLastReward && (
                        <button
                          type="button"
                          onClick={() => void run(() => undoRewardBatch())}
                          className="atlas-quiet text-xs"
                        >
                          <Undo2 className="h-4 w-4" />
                          <span>Отменить начисление</span>
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              )}

              <details className="border-t border-ln pt-3">
                <summary className="cursor-pointer py-1.5 text-sm font-bold text-mu">
                  Расширенные критерии, таймеры и ручной ход по треку
                </summary>
                <div className="mt-4 space-y-4">
                  {teams.length > 0 && <RewardPanel teams={teams} template={template} run={run} />}
                  {!physical && (
                    <ShiftControls
                      gameState={gameState}
                      totalDays={template.totalDays}
                      clockOffsetMs={clockOffsetMs}
                      run={run}
                    />
                  )}
                  {template.features.storyBriefings && (
                    <BriefingEditor template={template} currentDay={gameState.currentDay} run={run} />
                  )}
                  <EventFeed feed={snapshot.feed} teams={teams} title="Журнал смены" />
                </div>
              </details>
            </div>
          )}

          {tab === "cards" && <CardsStudioTab snapshot={snapshot} run={run} />}

          {tab === "balance" && <MechanicsTab snapshot={snapshot} run={run} />}

          {tab === "teams" && (
            <div className="space-y-4">
              <TeamsBoard
                teams={teams}
                members={snapshot.members}
                template={template}
                purchaseLimit={gameState.dailyPurchaseLimit}
                run={run}
              />
              <TemplateSwitcher templates={snapshot.availableTemplates} activeId={template.id} run={run} />
            </div>
          )}
        </div>
      )}

      <ShiftWizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        templates={snapshot.availableTemplates}
        run={run}
        onCreated={() => {
          setStudioMode("live");
          setTab("teams");
        }}
      />

      <BroadcastSheet open={broadcastOpen} teams={teams} onClose={() => setBroadcastOpen(false)} />
    </article>
  );
}
