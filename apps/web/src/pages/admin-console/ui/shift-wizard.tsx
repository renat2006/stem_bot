import type { TemplateSummary } from "@stem/shared";
import { CheckCircle2, Rocket } from "lucide-react";
import { useState } from "react";
import { createShiftFromWizard, updateFeatures } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BottomSheet, ToggleSwitch } from "../../../shared/ui/index.js";

const STEPS = ["Сеттинг", "Механики", "Колода", "Команды"] as const;

export function ShiftWizardSheet({
  open,
  onClose,
  templates,
  run,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateSummary[];
  run: RunAction;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [basePresetId, setBasePresetId] = useState(
    () => templates.find((t) => t.id.includes("rover"))?.id ?? templates[0]?.id ?? "rover-sprint-cu",
  );
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [totalDays, setTotalDays] = useState(6);
  const [useAiLoreAndCards, setUseAiLoreAndCards] = useState(false);
  const [cardCount, setCardCount] = useState(18);
  const [teamCount, setTeamCount] = useState(6);

  const [flags, setFlags] = useState({
    p2pMarket: true,
    auctions: true,
    slotInventory: true,
    storyBriefings: true,
    dayEvents: true,
    catchUpBonus: true,
  });

  const selectedPreset = templates.find((t) => t.id === basePresetId);

  const handleLaunch = () => {
    void run(async () => {
      await createShiftFromWizard({
        baseTemplateId: basePresetId,
        title: title.trim() || selectedPreset?.title || "Спринт роверов",
        theme: theme.trim() || selectedPreset?.theme || "Инженерный спринт автономных роверов",
        totalDays,
        teamCount,
        useAiLoreAndCards,
        cardCount,
      });
      return updateFeatures(flags);
    }).then((ok) => {
      if (ok) {
        setStep(0);
        onClose();
        onCreated();
      }
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Конструктор новой смены">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase text-ac">Мастер запуска · шаг {step + 1} из 4</p>
            <h3 className="text-xl font-semibold text-fg">{STEPS[step]}</h3>
          </div>
          <div className="flex gap-1">
            {STEPS.map((label, idx) => (
              <span key={label} className={`h-2 w-6 rounded-full ${idx <= step ? "bg-ac" : "bg-sf2"}`} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-mu">Выберите базовый мир смены и при желании уточните название:</p>
            <div className="space-y-2">
              {templates.map((item) => {
                const active = item.id === basePresetId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setBasePresetId(item.id);
                      setTitle(item.title);
                      setTheme(item.theme);
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left ${
                      active ? "border-ac bg-ac/10" : "border-ln bg-sf"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-fg">
                        {item.currencyIcon} {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-mu">{item.theme}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 flex min-w-0 flex-col gap-1">
                <span className="text-xs text-mu">Название смены</span>
                <input
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
                  value={totalDays}
                  onChange={(e) => setTotalDays(Math.max(2, Math.min(10, Number(e.target.value))))}
                  className="h-11 min-w-0 w-full rounded-xl border border-ln bg-sf px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
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
            <div className="rounded-xl border border-ac/30 bg-ac/8 p-3 text-xs text-mu">
              <p className="flex items-center gap-1.5 font-semibold text-fg">
                <CheckCircle2 className="h-3.5 w-3.5 text-ac" />
                Баланс редкостей настроен автоматически
              </p>
              <p className="mt-1">
                Обычные карты закрывают базовые слоты, редкие дают скачок характеристик с обязательным
                компромиссом, а легендарные открываются ближе к финалу смены.
              </p>
            </div>
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
                value={teamCount}
                onChange={(e) => setTeamCount(Math.max(2, Math.min(20, Number(e.target.value))))}
                className="h-11 rounded-xl border border-ln bg-sf px-3.5 font-mono text-base font-semibold text-fg"
              />
            </label>
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
            {step > 0 ? "Назад" : "Отмена"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="h-11 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
            >
              Дальше
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ac px-6 text-sm font-semibold text-acfg"
            >
              <Rocket className="h-4 w-4" />
              Запустить смену
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
