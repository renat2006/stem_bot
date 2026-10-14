import type { CardItem } from "@stem/shared";
import { useEffect, useState } from "react";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import {
  getThresholdsForStat,
  StatGrid,
  StatMeter,
  StepBlocks,
  TrackProgress,
} from "../../../entities/team/index.js";
import { undoLastPurchase } from "../../../features/purchase/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import {
  BottomSheet,
  Coin,
  formatStatValue,
  ModuleCard,
  StatGlyph,
  ToastWithUndo,
} from "../../../shared/ui/index.js";
import { Shop } from "../../../widgets/shop/index.js";
import { SlotBuild } from "../../../widgets/slot-build/index.js";
import { TeamSummary } from "../../../widgets/team-summary/index.js";

type ParticipantScreen = "join" | "onb" | "home" | "market" | "track" | "rules";
type HelpKey = "build" | "step" | "extra" | null;

const SUB_TABS: Array<{ id: Exclude<ParticipantScreen, "join" | "onb">; label: string }> = [
  { id: "home", label: "Команда" },
  { id: "market", label: "Рынок" },
  { id: "track", label: "Трек" },
  { id: "rules", label: "Правила" },
];

interface TeamDashboardPageProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  run: RunAction;
}

export function TeamDashboardPage({ snapshot, team, run }: TeamDashboardPageProps) {
  const { template, gameState, teams } = snapshot;
  const [screen, setScreen] = useState<ParticipantScreen>("home");
  const [role, setRole] = useState<"captain" | "member">("captain");
  const [onbStep, setOnbStep] = useState(0);
  const [joinName, setJoinName] = useState("Егор");
  const [marketSlotFilter, setMarketSlotFilter] = useState<string>("all");
  const [rulesSearch, setRulesSearch] = useState("");
  const [helpKey, setHelpKey] = useState<HelpKey>(null);
  const [secondsLeft, setSecondsLeft] = useState(gameState.secondsLeft);
  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);

  useEffect(() => {
    setSecondsLeft(gameState.secondsLeft);
  }, [gameState.secondsLeft]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.canUndo ? 6000 : 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const sortedTeams = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const teamRank = Math.max(1, sortedTeams.findIndex((t) => t.id === team.id) + 1);
  const rivalPositions = teams.filter((t) => t.id !== team.id).map((t) => t.trackPosition);

  const extra = template.extraModule;
  const extraStat = extra ? template.stats.find((s) => s.id === extra.statId) : undefined;
  const extraVal = extra ? (team.computedStats.total[extra.statId] ?? 0) : 0;
  const extraOk = extra ? extraVal >= extra.min : true;

  const limit = gameState.dailyPurchaseLimit ?? template.dailyPurchaseLimit ?? 2;
  const leftBuys = Math.max(0, limit - team.purchasesToday);

  const handleCardBought = (card: CardItem) => {
    setScreen("home");
    setToast({
      text: `«${card.name}» в сборке · −${card.price} ${template.currencyName}`,
      canUndo: true,
    });
  };

  const handleCardProposed = () => {
    setToast({
      text: `Предложение ушло капитану @${team.captainUsername}`,
      canUndo: false,
    });
  };

  const handleUndo = () => {
    setToast(null);
    void run(async () => {
      await undoLastPurchase(team.id);
      setToast({
        text: `Покупка отменена, ${template.currencyName} вернулись`,
        canUndo: false,
      });
    });
  };

  const rulesSections = [
    {
      title: "Шаг за ход",
      module: "ГОНКА ПО ТРЕКУ",
      rows: [
        { label: "Каждый ход (база)", value: "+1", stat: undefined },
        ...template.stepThresholds.map((th) => {
          const st = template.stats.find((s) => s.id === th.statId);
          return {
            label: `${st?.label ?? th.statId} от ${th.min}`,
            value: `+${th.bonus}`,
            stat: st,
          };
        }),
        ...template.perks
          .filter((p) => p.stepBonus > 0)
          .map((p) => ({
            label: `${p.shortName ?? p.name}: ${p.effectText}`,
            value: `+${p.stepBonus}`,
            stat: undefined,
          })),
      ],
    },
    {
      title: "Сборка",
      module: "СБОРКА ПО СЛОТАМ",
      rows: [
        { label: `${template.slots.length} слотов, одна карта на слот`, value: "", stat: undefined },
        { label: "Новая карта вытесняет старую, склада нет", value: "", stat: undefined },
        { label: "Сильные карты всегда с минусом", value: "", stat: undefined },
      ],
    },
    {
      title: "Рынок",
      module: "ОБЩИЙ РЫНОК",
      rows: [
        { label: "Покупок за одну точку", value: String(limit), stat: undefined },
        { label: "Рынок общий: все команды видят одни карты", value: "", stat: undefined },
        {
          label: "Открыто дней прогрессии",
          value: `${gameState.currentDay}/${template.totalDays}`,
          stat: undefined,
        },
      ],
    },
    ...(extra
      ? [
          {
            title: extra.tag,
            module: extra.moduleLabel,
            rows: [
              {
                label: `${extraStat?.label ?? extra.statId} от ${extra.min}`,
                value: extra.danger ? "без штрафа" : "заказ сдан",
                stat: extraStat,
              },
              ...extra.chips.map((c) => ({ label: c, value: "", stat: undefined })),
            ],
          },
        ]
      : []),
    {
      title: `Как получить ${template.currencyName}`,
      module: "НАЧИСЛЕНИЕ ЗА УЧЁБУ",
      rows: template.rewardReasons.map((r) => ({ label: r, value: "+2", stat: undefined })),
    },
  ];

  const filteredRules = rulesSections.filter((sec) => {
    if (!rulesSearch.trim()) return true;
    const q = rulesSearch.toLowerCase();
    return sec.title.toLowerCase().includes(q) || sec.rows.some((r) => r.label.toLowerCase().includes(q));
  });

  const helpSection =
    helpKey === "build"
      ? rulesSections[1]
      : helpKey === "step"
        ? rulesSections[0]
        : helpKey === "extra"
          ? rulesSections[3]
          : undefined;

  const isPreGame = screen === "join" || screen === "onb";
  const sampleCard = template.cards[0];
  const sampleStat = template.stats[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ln bg-sf px-2.5 py-1.5">
        <div className="flex gap-1 rounded-lg bg-sf2 p-0.5">
          <button
            type="button"
            onClick={() => setRole("captain")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              role === "captain" ? "bg-fg text-bg" : "text-mu"
            }`}
          >
            Капитан @{team.captainUsername}
          </button>
          <button
            type="button"
            onClick={() => setRole("member")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              role === "member" ? "bg-fg text-bg" : "text-mu"
            }`}
          >
            Участник
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setScreen("join");
            setOnbStep(0);
          }}
          className="px-2 py-1 font-mono text-[11px] font-medium text-ac"
        >
          Вход и онбординг →
        </button>
      </div>

      {!isPreGame && (
        <div className="sticky top-0 z-20 -mx-1 bg-bg py-1">
          <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-sf2 p-[3px]">
            {SUB_TABS.map((t) => {
              const active = screen === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.id === "market") setMarketSlotFilter("all");
                    setScreen(t.id);
                  }}
                  style={{
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                  }}
                  className={`min-h-[36px] rounded-[9px] text-[13px] font-medium transition ${
                    active ? "bg-sf text-fg" : "bg-transparent text-mu"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {screen === "join" && (
        <div className="space-y-4 pt-1">
          <div
            className="flex h-[132px] items-end justify-between rounded-2xl border border-ln p-3.5"
            style={{
              background: "repeating-linear-gradient(135deg, var(--sf2) 0 8px, var(--sf) 8px 16px)",
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-mu">
                {template.eventTag}
              </span>
              <span className="text-[22px] leading-tight font-semibold text-fg">{template.title}</span>
            </div>
            <span className="font-mono text-[10px] text-mu">обложка события</span>
          </div>

          {template.facts.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {template.facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex flex-col gap-0.5 rounded-xl border border-ln bg-sf p-2.5"
                >
                  <span className="font-mono text-xl leading-none font-semibold text-fg">{fact.value}</span>
                  <span className="text-[11.5px] text-mu">{fact.label}</span>
                </div>
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-fg">Как вас зовут</span>
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Имя"
              className="h-12 rounded-xl border border-ln bg-sf px-3.5 text-base text-fg focus:border-ac focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-fg">Код команды</span>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((pos) => (
                <div
                  key={`code-pos-${pos}`}
                  className="flex h-14 items-center justify-center rounded-xl border-[1.5px] border-ac bg-sf font-mono text-2xl font-semibold text-fg"
                >
                  {team.joinCode[pos] ?? ""}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[14px] border border-ln bg-sf p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
              {team.monogram}
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-semibold text-fg">{team.name}</span>
              <span className="text-[12.5px] text-mu">
                капитан @{team.captainUsername} · {team.members.length} в команде
              </span>
            </div>
            <div className="flex">
              {team.members.map((mb) => (
                <span
                  key={`member-${mb}`}
                  className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-sf bg-sf2 text-[11px] font-semibold text-fg"
                >
                  {mb}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!joinName.trim()}
            onClick={() => {
              setScreen("onb");
              setOnbStep(0);
            }}
            className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:bg-sf2 disabled:text-mu"
          >
            {joinName.trim() ? `Войти в «${team.name}»` : "Введите имя"}
          </button>
        </div>
      )}

      {screen === "onb" && (
        <div className="space-y-4 pt-1">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((stepIdx) => (
              <div
                key={stepIdx}
                className={`h-1 flex-1 rounded-full ${stepIdx <= onbStep ? "bg-ac" : "bg-sf2"}`}
              />
            ))}
          </div>

          <div
            className="flex h-[280px] items-center justify-center rounded-[18px] border border-ln bg-sf p-5"
            style={{
              backgroundImage: "radial-gradient(var(--ln) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          >
            {onbStep === 0 && (
              <div className="flex w-full flex-col items-center gap-4">
                <div className="flex w-full flex-col gap-1.5">
                  {template.rewardReasons.slice(0, 5).map((reason) => (
                    <div key={reason} className="flex items-center gap-2.5 rounded-lg bg-bg px-2.5 py-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-ac text-[10px] font-bold text-acfg">
                        ✓
                      </span>
                      <span className="flex-1 text-[12.5px] text-fg">{reason}</span>
                      <span className="font-mono text-xs font-semibold text-fg">+2</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-3xl leading-none font-semibold text-fg">+10</span>
                  <Coin size={20} />
                </div>
              </div>
            )}

            {onbStep === 1 && sampleCard && (
              <div className="flex items-center gap-3.5">
                <div className="flex w-32 -rotate-3 flex-col gap-1.5 rounded-xl border border-ln bg-bg p-2.5 shadow-md">
                  <span className="font-mono text-[9.5px] tracking-[0.06em] uppercase text-mu">
                    {template.slots.find((s) => s.id === sampleCard.slotId)?.label ?? sampleCard.slotId}
                  </span>
                  <span className="text-sm leading-tight font-semibold text-fg">{sampleCard.name}</span>
                  <StatDeltaList stats={template.stats} deltas={sampleCard.stats} />
                </div>
                <span className="font-mono text-lg text-ac">→</span>
                <div className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ac p-2 text-center">
                  <span className="font-mono text-[10px] uppercase text-ac">СЛОТ</span>
                  <span className="text-xs text-mu">старая карта уходит</span>
                </div>
              </div>
            )}

            {onbStep === 2 && sampleStat && (
              <div className="flex w-full flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
                    <StatGlyph shape={sampleStat.shape} color={sampleStat.color} size={11} />
                    {sampleStat.label} {formatStatValue(team.computedStats.total[sampleStat.id] ?? 0)}
                  </span>
                  <StatMeter
                    stat={sampleStat}
                    value={team.computedStats.total[sampleStat.id] ?? 0}
                    marks={getThresholdsForStat(template, team.activePerkId, sampleStat.id)}
                  />
                </div>
                <StepBlocks step={team.computedStats.step} stats={template.stats} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <h3 className="text-[22px] leading-tight font-semibold text-fg">
              {onbStep === 0
                ? `Учитесь — получайте ${template.currencyName}`
                : onbStep === 1
                  ? "Покупайте карты в слоты"
                  : "Пороги дают шаги"}
            </h3>
            <p className="text-[14.5px] leading-relaxed text-mu">
              {onbStep === 0
                ? `После каждого учебного блока админ отмечает критерии работы команды. Каждый даёт 2 ${template.currencyName}.`
                : onbStep === 1
                  ? "В каждом слоте одна карта. Новая карта заменяет старую: склада нет, думайте, что вытесняете."
                  : "Когда характеристика дотягивает до отмеченной клетки, вы получаете бонус к шагу. Кто дальше на треке, тот выше в рейтинге."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setScreen("home")}
              className="min-h-[44px] text-sm font-medium text-ac"
            >
              Пропустить
            </button>
            <button
              type="button"
              onClick={() => {
                if (onbStep < 2) setOnbStep((s) => s + 1);
                else setScreen("home");
              }}
              className="h-11 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
            >
              {onbStep < 2 ? "Дальше" : "Начать игру"}
            </button>
          </div>
        </div>
      )}

      {screen === "home" && (
        <div className="space-y-3">
          <TeamSummary
            team={team}
            template={template}
            gameState={gameState}
            teamRank={teamRank}
            totalTeams={teams.length}
            secondsLeft={secondsLeft}
          />

          <SlotBuild
            team={team}
            template={template}
            gameState={gameState}
            onSelectEmptySlot={(slotId) => {
              setMarketSlotFilter(slotId);
              setScreen("market");
            }}
            onHelp={() => setHelpKey("build")}
          />

          <ModuleCard
            title="Характеристики"
            badge={
              <span className="flex items-center gap-1.5 text-[11px] text-mu">
                <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-ac" />
                порог даёт шаг
              </span>
            }
            onHelp={() => setHelpKey("step")}
          >
            <StatGrid
              stats={template.stats}
              values={team.computedStats.total}
              template={template}
              activePerkId={team.activePerkId}
            />
          </ModuleCard>

          <ModuleCard
            title="Ход"
            subtitle={`клетка ${team.trackPosition} → ${Math.min(template.trackMax, team.trackPosition + team.computedStats.step.total)}`}
            onHelp={() => setHelpKey("step")}
          >
            <div className="space-y-3.5">
              <StepBlocks step={team.computedStats.step} stats={template.stats} />
              <TrackProgress
                label={template.trackName}
                position={team.trackPosition}
                max={template.trackMax}
                stepForecast={team.computedStats.step.total}
                rivalPositions={rivalPositions}
              />
            </div>
          </ModuleCard>

          {extra && extraStat && (
            <ModuleCard
              title={extra.tag}
              badge={
                <span
                  className={`rounded-[5px] border px-2 py-0.5 font-mono text-[11px] font-medium ${
                    extraOk ? "border-ln text-pos" : "border-warn text-warn"
                  }`}
                >
                  {extraOk ? extra.okLabel : extra.badLabel}
                </span>
              }
              onHelp={() => setHelpKey("extra")}
            >
              <div className="space-y-2.5">
                <span className="text-[15px] font-semibold text-fg">{extra.title}</span>
                <StatMeter
                  stat={extraStat}
                  value={extraVal}
                  marks={[
                    {
                      at: extra.min,
                      label: extra.danger ? "безоп." : "нужно",
                      danger: extra.danger,
                    },
                  ]}
                />
                <div className="flex flex-wrap gap-1.5">
                  {extra.chips.map((chipText, idx) => (
                    <span
                      key={chipText}
                      className={`rounded-[7px] bg-sf2 px-2.5 py-1 text-xs ${
                        idx === 0 && extra.danger ? "text-warn" : "text-fg"
                      }`}
                    >
                      {chipText}
                    </span>
                  ))}
                </div>
              </div>
            </ModuleCard>
          )}

          <button
            type="button"
            onClick={() => {
              setMarketSlotFilter("all");
              setScreen(leftBuys > 0 ? "market" : "track");
            }}
            className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg transition active:scale-[0.99]"
          >
            {leftBuys > 0 ? "Открыть рынок" : "Смотреть трек"}
          </button>
        </div>
      )}

      {screen === "market" && (
        <Shop
          key={marketSlotFilter}
          team={team}
          template={template}
          currentDay={gameState.currentDay}
          isOpen={gameState.purchasePhaseActive}
          gameState={gameState}
          initialSlotFilter={marketSlotFilter}
          role={role}
          onCardBought={handleCardBought}
          onCardProposed={handleCardProposed}
          run={run}
        />
      )}

      {screen === "track" && (
        <div className="space-y-3">
          <div>
            <h2 className="text-[21px] leading-tight font-semibold text-fg">{template.trackName}</h2>
            <p className="mt-0.5 text-[12.5px] text-mu">Прозрачная часть полосы — ваш прогноз на этот ход</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ln bg-sf">
            {sortedTeams.map((item, idx) => {
              const isMe = item.id === team.id;
              const target = Math.min(template.trackMax, item.trackPosition + item.computedStats.step.total);
              const barPct = Math.min(100, (item.trackPosition / template.trackMax) * 100);
              const forecastPct = Math.min(100, (target / template.trackMax) * 100);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 border-b border-ln px-3.5 py-2.5 last:border-b-0 ${
                    isMe ? "bg-sf2" : "bg-transparent"
                  }`}
                >
                  <span className="w-5 text-right font-mono text-[15px] font-semibold text-fg">
                    {idx + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${isMe ? "font-semibold text-fg" : "text-fg"}`}>
                        {isMe ? `${item.name} · вы` : item.name}
                      </span>
                      <span className="font-mono text-[12.5px] text-mu">
                        {item.trackPosition}/{template.trackMax}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded bg-sf2">
                      {isMe && (
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-ac opacity-30"
                          style={{ width: `${forecastPct}%` }}
                        />
                      )}
                      <div
                        className={`absolute inset-y-0 left-0 rounded ${
                          isMe ? "bg-ac opacity-100" : "bg-mu opacity-55"
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {screen === "rules" && (
        <div className="space-y-3">
          <input
            value={rulesSearch}
            onChange={(e) => setRulesSearch(e.target.value)}
            placeholder="Поиск по правилам"
            className="h-11 w-full rounded-xl bg-sf2 px-3.5 text-sm text-fg placeholder:text-mu focus:outline-none"
          />

          <div className="flex items-center gap-2 rounded-xl border border-ac px-3 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-ac" />
            <span className="text-[12.5px] text-fg">{gameState.rulesUpdatedNote}</span>
          </div>

          {filteredRules.map((sec) => (
            <div key={sec.title} className="flex flex-col gap-2.5 rounded-2xl border border-ln bg-sf p-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-[2px] bg-ac" />
                <span className="flex-1 text-[15px] font-semibold text-fg">{sec.title}</span>
                <span className="font-mono text-[10px] font-medium tracking-[0.06em] text-mu">
                  {sec.module}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {sec.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] bg-sf2 px-2.5 py-2"
                  >
                    {row.stat ? (
                      <StatGlyph shape={row.stat.shape} color={row.stat.color} size={11} />
                    ) : (
                      <span className="h-2 w-2 rounded-[2px] bg-ac" />
                    )}
                    <span className="text-[13px] leading-snug text-fg">{row.label}</span>
                    {row.value && (
                      <span className="font-mono text-[13px] font-semibold text-fg">{row.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={Boolean(helpSection)} onClose={() => setHelpKey(null)}>
        {helpSection && (
          <>
            <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-mu">
              {helpSection.module}
            </span>
            <h3 className="text-xl leading-tight font-semibold text-fg">{helpSection.title}</h3>
            <div className="flex flex-col gap-1.5">
              {helpSection.rows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] bg-sf px-3 py-2.5"
                >
                  {row.stat ? (
                    <StatGlyph shape={row.stat.shape} color={row.stat.color} size={11} />
                  ) : (
                    <span className="h-2 w-2 rounded-[2px] bg-ac" />
                  )}
                  <span className="text-[13.5px] leading-snug text-fg">{row.label}</span>
                  {row.value && <span className="font-mono text-sm font-semibold text-fg">{row.value}</span>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setHelpKey(null)}
              className="mt-1 h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg"
            >
              Понятно
            </button>
          </>
        )}
      </BottomSheet>

      {toast && (
        <ToastWithUndo
          text={toast.text}
          canUndo={toast.canUndo}
          onUndo={toast.canUndo ? handleUndo : undefined}
        />
      )}
    </div>
  );
}
