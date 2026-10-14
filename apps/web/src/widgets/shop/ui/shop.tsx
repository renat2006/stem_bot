import {
  type CardItem,
  evaluateBuyState,
  type GameState,
  type GameTemplate,
  previewCardEffect,
} from "@stem/shared";
import { useState } from "react";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { getThresholdsForStat, StatMeter, StepBlocks } from "../../../entities/team/index.js";
import { buyCard, buyPerk, proposeCardToCaptain } from "../../../features/purchase/index.js";
import { type RunAction, useTelegramBackButton } from "../../../shared/lib/index.js";
import {
  BottomSheet,
  BuySlots,
  Coin,
  formatSigned,
  formatStatValue,
  StatGlyph,
  TierBars,
} from "../../../shared/ui/index.js";

const TIERS = ["Базовая", "Усиленная", "Продвинутая", "Элитная", "Легендарная"];
const ROM = ["I", "II", "III", "IV", "V"];

interface ShopProps {
  team: TeamWithStats;
  template: GameTemplate;
  currentDay: number;
  isOpen: boolean;
  gameState?: GameState;
  slotFilter: string;
  onChangeSlotFilter: (slotId: string) => void;
  role?: "captain" | "member";
  onCardBought?: (card: CardItem) => void;
  onCardProposed?: (card: CardItem) => void;
  run: RunAction;
}

export function Shop({
  team,
  template,
  currentDay,
  isOpen,
  gameState,
  slotFilter,
  onChangeSlotFilter,
  role = "captain",
  onCardBought,
  onCardProposed,
  run,
}: ShopProps) {
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useTelegramBackButton(Boolean(selectedCardId), () => setSelectedCardId(null));

  const slotLabel = new Map(template.slots.map((slot) => [slot.id, slot.label]));
  const cardById = new Map(template.cards.map((c) => [c.id, c]));
  const stockLeftMap = gameState?.cardStockLeft ?? {};
  const soldToMap = gameState?.cardSoldTo ?? {};
  const limit = gameState?.dailyPurchaseLimit ?? template.dailyPurchaseLimit ?? 2;
  const leftBuys = Math.max(0, limit - team.purchasesToday);

  const availableByDay = template.cards.filter((card) => card.dayAvailable <= currentDay);
  const filteredCards = availableByDay.filter(
    (card) =>
      (slotFilter === "all" || card.slotId === slotFilter) &&
      (!affordableOnly || card.price <= team.currency),
  );
  const perks = template.perks.filter((perk) => perk.dayAvailable <= currentDay);
  const maxOpenTier = Math.max(1, ...availableByDay.map((c) => c.tier));

  const selectedCard = selectedCardId ? cardById.get(selectedCardId) : undefined;
  const selectedPreview = selectedCard ? previewCardEffect(team, selectedCard, template) : undefined;
  const selectedBuyState = selectedCard
    ? evaluateBuyState({
        template,
        team,
        card: selectedCard,
        stockLeft: stockLeftMap[selectedCard.id] ?? selectedCard.stock,
        soldToTeam: soldToMap[selectedCard.id],
        isOpen,
        dailyLimit: limit,
        isCaptain: role === "captain",
      })
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[21px] leading-tight font-semibold text-fg">Общий рынок</h2>
          <p className="mt-0.5 text-[13px] text-mu">Одни карты для всех команд · День 1–{currentDay}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="flex items-center gap-1.5 font-mono text-2xl leading-none font-semibold text-fg">
            {team.currency}
            <Coin size={16} />
          </span>
          <span className={`mt-1 font-mono text-xs ${isOpen ? "text-pos" : "text-warn"}`}>
            {isOpen ? "рынок открыт" : "рынок закрыт"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl bg-sf2 px-3.5 py-2.5">
        <BuySlots used={team.purchasesToday} limit={limit} />
        <span className="flex-1 text-[13px] font-medium text-fg">
          {leftBuys > 0 ? `осталось покупок: ${leftBuys} из ${limit}` : "лимит покупок исчерпан"}
        </span>
        <div className="flex items-end gap-[2px]">
          {[0, 1, 2, 3, 4].map((idx) => (
            <span
              key={idx}
              className="inline-block rounded-[1px]"
              style={{
                width: 4,
                height: 6 + idx * 2,
                background: idx < maxOpenTier ? "var(--fg)" : "transparent",
                boxShadow: idx < maxOpenTier ? "none" : "inset 0 0 0 1px var(--mu)",
              }}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-mu">
          {maxOpenTier < 5 ? `${ROM[maxOpenTier]} · д.${currentDay + 1}` : "все тиры"}
        </span>
      </div>

      <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1">
        <button
          type="button"
          onClick={() => onChangeSlotFilter("all")}
          className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[13px] font-medium transition ${
            slotFilter === "all" ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
          }`}
        >
          Все
        </button>
        {template.slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => onChangeSlotFilter(slot.id)}
            className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[13px] font-medium transition ${
              slotFilter === slot.id ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
            }`}
          >
            {slot.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAffordableOnly((v) => !v)}
          className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[13px] font-medium transition ${
            affordableOnly ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
          }`}
        >
          По карману
        </button>
      </div>

      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-ln px-4 py-6 text-center">
          <span className="font-semibold text-fg">Под фильтр ничего нет</span>
          <span className="text-[13px] text-mu">Попробуйте другой слот или снимите «По карману».</span>
          <button
            type="button"
            onClick={() => {
              onChangeSlotFilter("all");
              setAffordableOnly(false);
            }}
            className="min-h-[44px] rounded-xl border border-ln bg-sf px-4 text-sm font-medium text-fg"
          >
            Показать все карты
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCards.map((card) => {
            const left = stockLeftMap[card.id] ?? card.stock;
            const soldOut = left <= 0;
            const equipped = team.equippedCards[card.slotId] === card.id;
            const preview = previewCardEffect(team, card, template);
            const stepDelta = preview.stepDelta;
            const tierIdx = Math.max(0, Math.min(4, card.tier - 1));

            const note = equipped
              ? "Уже установлено в вашей сборке"
              : soldOut
                ? `Раскупили · последнюю взяла «${soldToMap[card.id] ?? "другая команда"}»`
                : card.sellerTeam
                  ? `Продаёт команда «${card.sellerTeam}»`
                  : preview.replacedCard
                    ? `Заменит «${preview.replacedCard.name}»`
                    : "В пустой слот";

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCardId(card.id)}
                className={`flex w-full flex-col items-start gap-2.5 rounded-2xl border border-ln bg-sf p-4 text-left transition active:scale-[0.99] ${
                  soldOut ? "opacity-55" : "opacity-100"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
                    {slotLabel.get(card.slotId) ?? card.slotId}
                  </span>
                  <span className="flex items-end gap-1.5">
                    <TierBars tier={card.tier} />
                    <span className="font-mono text-xs font-medium text-mu">
                      {ROM[tierIdx]} {TIERS[tierIdx]}
                    </span>
                  </span>
                </div>

                <div className="flex w-full items-start justify-between gap-2.5">
                  <span className="text-[17px] leading-snug font-semibold text-fg">{card.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono text-xl leading-none font-semibold text-fg">
                    {card.price}
                    <Coin size={16} />
                  </span>
                </div>

                <StatDeltaList stats={template.stats} deltas={card.stats} size="lg" />

                <div className="flex w-full items-center justify-between gap-2 border-t border-dashed border-ln pt-2.5">
                  <span className="flex items-center gap-2 text-xs text-mu">
                    <span className="flex gap-1">
                      {[1, 2, 3, 4, 5].slice(0, card.stock).map((dotNum) => (
                        <span
                          key={`${card.id}-dot-${dotNum}`}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: dotNum <= left ? "var(--fg)" : "var(--ln)" }}
                        />
                      ))}
                    </span>
                    {soldOut ? "раскупили" : `${left} из ${card.stock}`}
                  </span>

                  <span className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-fg">
                    шаг {preview.afterStats.step.total}
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                        stepDelta < 0
                          ? "bg-warn text-bg"
                          : stepDelta > 0
                            ? "bg-pos text-bg"
                            : "bg-sf2 text-mu"
                      }`}
                    >
                      {stepDelta === 0 ? "=" : formatSigned(stepDelta)}
                    </span>
                  </span>
                </div>

                <span className="text-xs text-mu">{note}</span>
              </button>
            );
          })}
        </div>
      )}

      {perks.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ln bg-sf p-4">
          <h4 className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-mu">
            Специальные свойства (1 активное)
          </h4>
          <div className="mt-3 space-y-2.5">
            {perks.map((perk) => {
              const active = team.activePerkId === perk.id;
              const canBuyPerk = isOpen && role === "captain" && !active && team.currency >= perk.price;
              return (
                <div
                  key={perk.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-sf2 p-3.5"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-fg">{perk.name}</p>
                    <p className="text-xs leading-snug text-mu">{perk.effectText}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canBuyPerk}
                    onClick={() => run(() => buyPerk(team.id, perk.id))}
                    className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-ac px-3.5 font-mono text-xs font-semibold text-acfg disabled:opacity-40"
                  >
                    {active ? (
                      "Активно"
                    ) : role !== "captain" ? (
                      "Капитан"
                    ) : (
                      <>
                        {perk.price}
                        <Coin size={14} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BottomSheet
        open={Boolean(selectedCard && selectedPreview && selectedBuyState)}
        onClose={() => setSelectedCardId(null)}
      >
        {selectedCard && selectedPreview && selectedBuyState && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
                  СЛОТ · {slotLabel.get(selectedCard.slotId) ?? selectedCard.slotId}
                </span>
                <h3 className="text-[22px] leading-tight font-semibold text-fg">{selectedCard.name}</h3>
                <span className="flex items-end gap-1.5">
                  <TierBars tier={selectedCard.tier} />
                  <span className="font-mono text-xs font-medium text-mu">
                    {ROM[Math.max(0, selectedCard.tier - 1)]} {TIERS[Math.max(0, selectedCard.tier - 1)]}
                  </span>
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[28px] leading-none font-semibold text-fg">
                {selectedCard.price}
                <Coin size={20} />
              </span>
            </div>

            <div className="grid grid-cols-[1fr_28px_1fr] items-center gap-2">
              <div
                className={`flex flex-col gap-1 rounded-xl border-[1.5px] border-dashed p-3 ${
                  selectedPreview.replacedCard
                    ? "border-neg bg-sf opacity-90"
                    : "border-ln bg-transparent opacity-75"
                }`}
              >
                <span className="font-mono text-[11px] font-medium tracking-[0.05em] text-mu">СЕЙЧАС</span>
                <span className="text-sm leading-snug font-medium text-fg">
                  {selectedPreview.replacedCard?.name ?? "пусто"}
                </span>
              </div>

              <div className="flex justify-center">
                <span className="h-2.5 w-2.5 rotate-45 border-t-2 border-r-2 border-mu" />
              </div>

              <div className="flex flex-col gap-1 rounded-xl border-[1.5px] border-ac bg-sf p-3">
                <span className="font-mono text-[11px] font-medium tracking-[0.05em] text-ac">СТАНЕТ</span>
                <span className="text-sm leading-snug font-medium text-fg">{selectedCard.name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 rounded-2xl border border-ln bg-sf p-4">
              <div className="flex flex-wrap gap-3 text-xs text-mu">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-[2px] bg-fg opacity-75" />
                  остаётся
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-3.5 rounded-[2px] border border-pos"
                    style={{
                      background: "repeating-linear-gradient(135deg, var(--pos) 0 2px, transparent 2px 4px)",
                    }}
                  />
                  прибавится
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-[2px] border-[1.5px] border-dashed border-neg" />
                  уйдёт
                </span>
              </div>

              {template.stats.map((stat) => {
                const beforeVal = selectedPreview.beforeStats.total[stat.id] ?? 0;
                const afterVal = selectedPreview.afterStats.total[stat.id] ?? 0;
                const diff = afterVal - beforeVal;
                const marks = getThresholdsForStat(template, team.activePerkId, stat.id);

                return (
                  <div key={stat.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                        <StatGlyph shape={stat.shape} color={stat.color} size={12} />
                        {stat.label}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl leading-none font-semibold text-fg">
                          {formatStatValue(afterVal)}
                        </span>
                        {diff !== 0 && (
                          <span
                            className={`font-mono text-sm font-semibold ${
                              diff > 0 ? "text-pos" : "text-neg"
                            }`}
                          >
                            {formatSigned(diff)}
                          </span>
                        )}
                      </span>
                    </div>
                    <StatMeter stat={stat} value={beforeVal} afterValue={afterVal} marks={marks} />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-ln bg-sf p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-fg">Шаг за ход</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-base text-mu line-through">
                    {selectedPreview.beforeStats.step.total}
                  </span>
                  <span className="font-mono text-2xl leading-none font-semibold text-fg">
                    {selectedPreview.afterStats.step.total}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                      selectedPreview.stepDelta < 0
                        ? "bg-warn text-bg"
                        : selectedPreview.stepDelta > 0
                          ? "bg-pos text-bg"
                          : "bg-sf2 text-mu"
                    }`}
                  >
                    {selectedPreview.stepDelta === 0
                      ? "без изменений"
                      : formatSigned(selectedPreview.stepDelta)}
                  </span>
                </span>
              </div>

              <StepBlocks
                step={selectedPreview.afterStats.step}
                referenceStep={selectedPreview.beforeStats.step}
                stats={template.stats}
              />

              {selectedPreview.lostParts.length > 0 && (
                <p className="text-[13px] leading-snug text-warn">
                  Пунктирные блоки перестанут работать:{" "}
                  {selectedPreview.lostParts.map((p) => p.label).join(", ")}.
                </p>
              )}
            </div>

            {selectedBuyState.blockHead && (
              <div className="flex items-start gap-2.5 rounded-xl border border-ln p-3.5">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45 bg-warn" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-fg">{selectedBuyState.blockHead}</span>
                  <span className="text-[13px] leading-snug text-mu">{selectedBuyState.blockText}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedBuyState.ok}
              onClick={() => {
                const cardToAct = selectedCard;
                setSelectedCardId(null);
                if (selectedBuyState.kind === "propose") {
                  void run(async () => {
                    await proposeCardToCaptain(team.id, cardToAct.id);
                    onCardProposed?.(cardToAct);
                  });
                } else {
                  void run(async () => {
                    await buyCard(team.id, cardToAct.id);
                    onCardBought?.(cardToAct);
                  });
                }
              }}
              className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sf2 disabled:text-mu"
            >
              {selectedBuyState.label}
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
