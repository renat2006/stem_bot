import {
  type CardItem,
  type DayScheduleItem,
  DEFAULT_TEMPLATES,
  ROVER_SPRINT_TEMPLATE,
  type RoundEngineType,
  resolveDaySchedule,
  type TemplateSummary,
} from "@stem/shared";
import { Rocket } from "lucide-react";
import { type SetStateAction, useEffect, useState } from "react";
import { createShiftFromWizard } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { ConfirmButton, ToggleSwitch } from "../../../shared/ui/index.js";

import { ImageField } from "./image-field.js";

const STEPS = ["Мир и название", "Правила", "Карты", "Команды и запуск"] as const;

export function ShiftWizardSheet({
  open,
  onClose,
  templates,
  storageKey,
  run,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateSummary[];
  storageKey: string;
  run: RunAction;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(() => {
    const initial = {
      teamNames: [] as string[],
      coverId: undefined as string | undefined,
      step: 0,
      basePresetId: templates.find((t) => t.id.includes("rover"))?.id ?? "rover-sprint-cu",
      title: "",
      theme: "",
      totalDays: 6,
      useAiLoreAndCards: false,
      cardCount: 18,
      teamCount: 6,
      flags: {
        p2pMarket: true,
        auctions: true,
        slotInventory: true,
        storyBriefings: true,
        dayEvents: true,
        catchUpBonus: true,
      },
      cards: null as CardItem[] | null,
      engines: {} as Record<number, RoundEngineType>,
      cardId: "",
    };
    try {
      return { ...initial, ...JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") } as typeof initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (open) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {}
    }
  }, [open, storageKey, draft]);
  function field<K extends keyof typeof draft>(key: K) {
    return (value: SetStateAction<(typeof draft)[K]>) =>
      setDraft((prev) => ({ ...prev, [key]: typeof value === "function" ? value(prev[key]) : value }));
  }
  const {
    teamNames,
    coverId,
    step,
    basePresetId,
    title,
    theme,
    totalDays,
    useAiLoreAndCards,
    cardCount,
    teamCount,
    flags,
    cards,
    engines,
    cardId,
  } = draft;
  const setTeamNames = field("teamNames");
  const setCoverId = field("coverId");
  const setStep = field("step");
  const setBasePresetId = field("basePresetId");
  const setTitle = field("title");
  const setTheme = field("theme");
  const setTotalDays = field("totalDays");
  const setUseAiLoreAndCards = field("useAiLoreAndCards");
  const setCardCount = field("cardCount");
  const setTeamCount = field("teamCount");
  const setFlags = field("flags");
  const setCards = field("cards");
  const setEngines = field("engines");
  const setCardId = field("cardId");
  const selectedPreset = templates.find((t) => t.id === basePresetId);
  const base = DEFAULT_TEMPLATES.find((t) => t.id === basePresetId) ?? ROVER_SPRINT_TEMPLATE;
  const catalog = cards ?? base.cards;
  const card = catalog.find((c) => c.id === cardId);
  const changeCard = (patch: Partial<CardItem>) =>
    setCards(catalog.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
  const defaults = resolveDaySchedule(base);
  const schedule: DayScheduleItem[] = Array.from({ length: totalDays }, (_, i) => ({
    day: i + 1,
    engine: engines[i + 1] ?? defaults[i]?.engine ?? "legacy_track",
  }));
  const invalid =
    (!useAiLoreAndCards && (!catalog.length || catalog.some((c) => !c.name.trim()))) ||
    title.trim().length === 1 ||
    (useAiLoreAndCards && theme.trim().length > 0 && theme.trim().length < 3);
  const handleLaunch = () => {
    if (busy || uploading) return;
    setBusy(true);
    void run(() =>
      createShiftFromWizard({
        baseTemplateId: basePresetId,
        title: title.trim() || selectedPreset?.title || "Новая смена",
        theme: theme.trim() || selectedPreset?.theme || "Инженерная смена",
        totalDays,
        teamCount,
        teamNames: Array.from({ length: teamCount }, (_, i) => teamNames[i]?.trim() || `Команда ${i + 1}`),
        features: flags,
        daySchedule: schedule,
        cards: useAiLoreAndCards ? undefined : (cards ?? undefined),
        coverId,
        useAiLoreAndCards,
        cardCount,
      }),
    ).then((ok) => {
      setBusy(false);
      if (ok) {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
        onClose();
        onCreated();
      }
    });
  };

  if (!open) return null;
  return (
    <section aria-label="Подготовка новой смены" className="shift-setup">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase text-ac">Мастер запуска · шаг {step + 1} из 4</p>
            <h3 className="text-xl font-semibold text-fg">{STEPS[step]}</h3>
          </div>
        </div>

        <nav className="studio-steps" aria-label="Подготовка смены">
          {STEPS.map((name, i) => (
            <button
              type="button"
              key={name}
              aria-current={step === i ? "step" : undefined}
              disabled={busy || uploading}
              onClick={() => setStep(i)}
            >
              {i + 1}. {name}
            </button>
          ))}
        </nav>
        {step === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 flex min-w-0 flex-col gap-1">
                <span className="text-xs text-mu">Название смены</span>
                <input
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selectedPreset?.title ?? "Спринт роверов"}
                  className="h-11 min-w-0 w-full rounded-xl border border-ln bg-sf px-3 text-sm text-fg"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-mu">Дней</span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  defaultValue={totalDays}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (Number.isInteger(value) && value >= 2 && value <= 10) setTotalDays(value);
                  }}
                  onBlur={(e) => {
                    e.currentTarget.value = String(totalDays);
                  }}
                  className="h-11 min-w-0 w-full rounded-xl border border-ln bg-sf px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
            </div>
            <h3 className="text-sm font-bold">Игровой мир</h3>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((item) => {
                const active = item.id === basePresetId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (basePresetId !== item.id) {
                        setCards(null);
                        setEngines({});
                        setCardId("");
                      }
                      setBasePresetId(item.id);
                      if (!title.trim() || title === selectedPreset?.title) setTitle(item.title);
                      setTheme(item.theme);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left ${
                      active ? "border-ac bg-ac/10" : "border-ln bg-sf"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-fg">
                        {item.currencyIcon} {item.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-mu">{selectedPreset?.theme}</p>
            <ImageField label="Обложка смены" id={coverId} onChange={setCoverId} onBusy={setUploading} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <h3 className="atlas-h2">Расписание</h3>
            <div className="grid gap-2">
              {schedule.map((d) => (
                <label key={d.day} className="flex items-center gap-3">
                  <span className="shrink-0">День {d.day}</span>
                  <select
                    className="studio-field"
                    value={d.engine}
                    onChange={(e) =>
                      setEngines((prev) => ({ ...prev, [d.day]: e.target.value as RoundEngineType }))
                    }
                  >
                    <option value="legacy_track">Ход на поле</option>
                    <option value="mission">Миссия экипажа</option>
                    <option value="diagnosis">Диагностика</option>
                  </select>
                </label>
              ))}
            </div>
            <h3 className="atlas-h2">Дополнительные правила</h3>
            <ToggleSwitch
              checked={flags.p2pMarket}
              onChange={(v) => setFlags({ ...flags, p2pMarket: v })}
              label="Биржа между командами"
              description="Свободная продажа деталей между командами в честном коридоре цен"
            />
            <ToggleSwitch
              checked={flags.auctions}
              onChange={(v) => setFlags({ ...flags, auctions: v })}
              label="Живые аукционы"
              description="Торги за редкие модули с таймером анти-снайпера"
            />
            <ToggleSwitch
              checked={flags.slotInventory}
              onChange={(v) => setFlags({ ...flags, slotInventory: v })}
              label="Склад запасных деталей"
              description="Команды сохраняют заменённые модули на складе"
            />
            <ToggleSwitch
              checked={flags.storyBriefings}
              onChange={(v) => setFlags({ ...flags, storyBriefings: v })}
              label="Сюжетные сводки по дням"
              description="Иллюстрированные легенды и вызовы дня"
            />
            <ToggleSwitch
              checked={flags.catchUpBonus}
              onChange={(v) => setFlags({ ...flags, catchUpBonus: v })}
              label="Бонус догоняющим командам"
              description="Помогает отстающим командам вернуться в борьбу"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <ToggleSwitch
              checked={useAiLoreAndCards}
              onChange={setUseAiLoreAndCards}
              label="Сгенерировать новый набор карт и легенд под вашу тему"
              description="Если выключено — используется выверенная эталонная колода выбранного сеттинга"
            />
            {useAiLoreAndCards && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-mu">Описание мира и темы смены</span>
                  <input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Например: автономные роверы в ледяном кратере"
                    className="h-11 min-w-0 w-full rounded-xl border border-ln bg-sf px-3 text-sm text-fg"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-mu">Размер колоды: {cardCount} карт</span>
                  <input
                    type="range"
                    min={12}
                    max={30}
                    step={3}
                    value={cardCount}
                    onChange={(e) => setCardCount(Number(e.target.value))}
                    className="accent-[var(--ac)]"
                  />
                </label>
              </>
            )}
            {!useAiLoreAndCards && (
              <div className="space-y-3">
                {catalog.length > 0 && (
                  <ConfirmButton
                    variant="accent"
                    confirmLabel="Очистить колоду черновика"
                    onConfirm={() => {
                      setCards([]);
                      setCardId("");
                    }}
                  >
                    Собрать колоду с нуля
                  </ConfirmButton>
                )}
                <label className="grid gap-1">
                  Детали смены ({catalog.length})
                  <select className="studio-field" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                    <option value="">Выберите деталь для изменения</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="atlas-quiet"
                  onClick={() => {
                    const id = crypto.randomUUID();
                    setCards([
                      ...catalog,
                      {
                        id,
                        name: "Новая деталь",
                        price: 2,
                        dayAvailable: 1,
                        rarity: "common",
                        tier: 1,
                        slotId: base.slots[0]?.id ?? "body",
                        stock: 4,
                        stats: {},
                        trackBonus: 0,
                      },
                    ]);
                    setCardId(id);
                  }}
                >
                  Добавить деталь
                </button>
                {card && (
                  <div className="grid gap-2">
                    <label>
                      Название детали
                      <input
                        className="studio-field"
                        value={card.name}
                        maxLength={80}
                        onChange={(e) => changeCard({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Слот
                      <select
                        className="studio-field"
                        value={card.slotId}
                        onChange={(e) => changeCard({ slotId: e.target.value })}
                      >
                        {base.slots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Цена
                      <input
                        type="number"
                        className="studio-field"
                        min={0}
                        max={50}
                        value={card.price}
                        onChange={(e) =>
                          changeCard({ price: Math.min(50, Math.max(0, Math.floor(Number(e.target.value)))) })
                        }
                      />
                    </label>
                    {base.stats.map((stat) => (
                      <label key={stat.id}>
                        {stat.label}
                        <input
                          className="studio-field"
                          type="number"
                          min={-6}
                          max={8}
                          value={card.stats[stat.id] ?? 0}
                          onChange={(e) =>
                            changeCard({
                              stats: {
                                ...card.stats,
                                [stat.id]: Math.min(8, Math.max(-6, Math.floor(Number(e.target.value)))),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    <ImageField
                      key={card.id}
                      label="Изображение детали"
                      id={card.imageId}
                      onBusy={setUploading}
                      onChange={(imageId) =>
                        setCards((prev) =>
                          (prev ?? base.cards).map((c) => (c.id === card.id ? { ...c, imageId } : c)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="atlas-quiet"
                      onClick={() => {
                        setCards(catalog.filter((c) => c.id !== cardId));
                        setCardId("");
                      }}
                    >
                      Убрать из смены
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-mu">Стартовое количество команд (можно добавить ещё позже)</span>
              <input
                type="number"
                min={2}
                max={20}
                defaultValue={teamCount}
                onChange={(e) => {
                  const value = e.target.valueAsNumber;
                  if (Number.isInteger(value) && value >= 2 && value <= 20) setTeamCount(value);
                }}
                onBlur={(e) => {
                  e.currentTarget.value = String(teamCount);
                }}
                className="h-11 rounded-xl border border-ln bg-sf px-3.5 font-mono text-base font-semibold text-fg"
              />
            </label>
            {Array.from({ length: teamCount }, (_, index) => index).map((i) => (
              <label key={`team-${i + 1}`} className="grid gap-1 text-sm">
                Название команды {i + 1}
                <input
                  className="studio-field"
                  maxLength={40}
                  placeholder={`Команда ${i + 1}`}
                  value={teamNames[i] ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setTeamNames((prev) => {
                      const next = [...prev];
                      next[i] = name;
                      return next;
                    });
                  }}
                />
              </label>
            ))}
            <p className="text-sm">
              {title.trim() || base.title} · Дней: {totalDays} · Карт:{" "}
              {useAiLoreAndCards ? cardCount : catalog.length} · Команд: {teamCount}
            </p>
            {invalid && (
              <p role="alert">
                Проверьте название смены и карт в колоде. Для запуска нужна хотя бы одна деталь.
              </p>
            )}
            <p className="text-sm font-semibold">
              После запуска эта смена заменит текущую. Команды получат новые коды входа.
            </p>
            <p className="text-xs leading-relaxed text-mu">
              Сразу после запуска появятся готовые коды и QR-карточки для капитанов всех {teamCount} команд.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            className="h-11 rounded-xl border border-ln bg-sf px-4 text-sm font-medium text-fg"
          >
            {step > 0 ? "Назад" : "К текущей смене"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() => setStep(step + 1)}
              className="h-11 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
            >
              Дальше
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || uploading || invalid}
              onClick={handleLaunch}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
            >
              <Rocket className="h-4 w-4" />
              {busy ? "Запускаем…" : "Запустить смену"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
