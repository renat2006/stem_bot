import {
  type CardItem,
  evaluateBuyState,
  type GameState,
  type GameTemplate,
  previewCardEffect,
} from "@stem/shared";
import { Flame } from "lucide-react";
import { useState } from "react";
import {
  AssemblyStage,
  PackIllustration,
  PackSymbol,
  PartSticker,
} from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { AuctionLot, P2PListing, TeamWithStats } from "../../../entities/game/index.js";
import { getThresholdsForStat, StatMeter, StepBlocks } from "../../../entities/team/index.js";
import { buyCard, buyPerk, proposeCard } from "../../../features/purchase/index.js";
import { type RunAction, useTelegramBackButton } from "../../../shared/lib/index.js";
import {
  BottomSheet,
  BuySlots,
  Coin,
  EffectScopeBadge,
  formatSigned,
  formatStatValue,
  RarityBadge,
  StatGlyph,
} from "../../../shared/ui/index.js";
import { AuctionMarketView } from "./auction-view.js";
import { P2PMarketView } from "./p2p-view.js";

type MarketSection = "shop" | "p2p" | "auction";

interface ShopProps {
  team: TeamWithStats;
  template: GameTemplate;
  currentDay: number;
  isOpen: boolean;
  gameState?: GameState;
  p2pListings?: P2PListing[];
  auctions?: AuctionLot[];
  clockOffsetMs?: number;
  slotFilter: string;
  onChangeSlotFilter: (slotId: string) => void;
  role?: "captain" | "member";
  onCardBought?: (card: CardItem) => void;
  onCardProposed?: (card: CardItem) => void;
  onToast?: (text: string) => void;
  run: RunAction;
}

export function Shop({
  team,
  template,
  currentDay,
  isOpen,
  gameState,
  p2pListings = [],
  auctions = [],
  clockOffsetMs = 0,
  slotFilter,
  onChangeSlotFilter,
  role = "captain",
  onCardBought,
  onCardProposed,
  onToast,
  run,
}: ShopProps) {
  const hasP2P = template.features.p2pMarket;
  const hasAuctions = template.features.auctions;
  const openAuctionsCount = auctions.filter((a) => a.status === "open").length;
  const activeListingsCount = p2pListings.length;

  const [section, setSection] = useState<MarketSection>(() =>
    openAuctionsCount > 0 && hasAuctions ? "auction" : "shop",
  );
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useTelegramBackButton(Boolean(selectedCardId), () => setSelectedCardId(null));

  const activeSection: MarketSection =
    section === "p2p" && !hasP2P ? "shop" : section === "auction" && !hasAuctions ? "shop" : section;

  const slotLabel = new Map(template.slots.map((slot) => [slot.id, slot.label]));
  const cardById = new Map(template.cards.map((c) => [c.id, c]));
  const stockLeftMap = gameState?.cardStockLeft ?? {};
  const soldToMap = gameState?.cardSoldTo ?? {};
  const limit = gameState?.dailyPurchaseLimit ?? template.dailyPurchaseLimit ?? 2;
  const leftBuys = Math.max(0, limit - team.purchasesToday);
  const availableCurrency = team.currency - (team.heldCurrency ?? 0);

  const availableByDay = template.cards.filter((card) => card.dayAvailable <= currentDay);
  const filteredCards = availableByDay.filter(
    (card) =>
      (slotFilter === "all" || card.slotId === slotFilter) &&
      (!affordableOnly || card.price <= availableCurrency),
  );
  const perks = template.perks.filter((perk) => perk.dayAvailable <= currentDay);

  const selectedCard = selectedCardId ? cardById.get(selectedCardId) : undefined;
  const selectedPreview = selectedCard ? previewCardEffect(team, selectedCard, template) : undefined;
  const selectedBuyState = selectedCard
    ? evaluateBuyState({
        template,
        team: { ...team, currency: availableCurrency },
        card: selectedCard,
        stockLeft: stockLeftMap[selectedCard.id] ?? selectedCard.stock,
        soldToTeam: soldToMap[selectedCard.id],
        isOpen,
        dailyLimit: limit,
        isCaptain: role === "captain",
      })
    : undefined;

  const showModeTabs = hasP2P || hasAuctions;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-fg">Торговая площадка</h2>
          <p className="mt-0.5 text-xs text-mu">
            День {currentDay} из {template.totalDays} · {isOpen ? "торги открыты" : "ожидание окна"}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="flex items-center gap-1.5 font-mono text-2xl leading-none font-semibold text-fg">
            {availableCurrency}
            <Coin size={16} />
          </span>
          {team.heldCurrency > 0 && (
            <span className="mt-1 font-mono text-[11px] text-warn">в ставке: {team.heldCurrency}</span>
          )}
        </div>
      </div>

      {showModeTabs && (
        <div className="flex gap-1 rounded-xl bg-sf2 p-1">
          <button
            type="button"
            onClick={() => setSection("shop")}
            className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
              activeSection === "shop" ? "bg-sf text-fg shadow-xs" : "text-mu"
            }`}
          >
            Магазин
          </button>
          {hasP2P && (
            <button
              type="button"
              onClick={() => setSection("p2p")}
              className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === "p2p" ? "bg-sf text-fg shadow-xs" : "text-mu"
              }`}
            >
              <span>Биржа</span>
              {activeListingsCount > 0 && (
                <span className="rounded-full bg-ac/20 px-1.5 py-0.2 font-mono text-[11px] text-ac">
                  {activeListingsCount}
                </span>
              )}
            </button>
          )}
          {hasAuctions && (
            <button
              type="button"
              onClick={() => setSection("auction")}
              className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === "auction" ? "bg-sf text-fg shadow-xs" : "text-mu"
              }`}
            >
              {openAuctionsCount > 0 && <Flame className="h-3.5 w-3.5 text-warn" />}
              <span>Аукцион</span>
              {openAuctionsCount > 0 && (
                <span className="rounded-full bg-warn/20 px-1.5 py-0.2 font-mono text-[11px] text-warn">
                  {openAuctionsCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {activeSection === "p2p" && hasP2P && (
        <P2PMarketView
          listings={p2pListings}
          team={team}
          template={template}
          isOpen={isOpen}
          isCaptain={role === "captain"}
          run={run}
          onToast={onToast}
        />
      )}

      {activeSection === "auction" && hasAuctions && (
        <AuctionMarketView
          auctions={auctions}
          team={team}
          template={template}
          clockOffsetMs={clockOffsetMs}
          isCaptain={role === "captain"}
          run={run}
          onToast={onToast}
        />
      )}

      {activeSection === "shop" && (
        <>
          <div className="flex items-center gap-2.5 rounded-xl bg-sf2 px-3.5 py-2.5">
            <BuySlots used={team.purchasesToday} limit={limit} />
            <span className="flex-1 text-xs font-medium text-fg">
              {leftBuys > 0 ? `доступно покупок: ${leftBuys} из ${limit}` : "лимит покупок на раунд закрыт"}
            </span>
          </div>

          <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1">
            <button
              type="button"
              onClick={() => onChangeSlotFilter("all")}
              className={`min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition ${
                slotFilter === "all" ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
              }`}
            >
              Все слоты
            </button>
            {template.slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => onChangeSlotFilter(slot.id)}
                className={`min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition ${
                  slotFilter === slot.id ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
                }`}
              >
                {slot.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAffordableOnly((v) => !v)}
              className={`min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition ${
                affordableOnly ? "border-fg bg-fg text-bg" : "border-ln bg-sf text-fg"
              }`}
            >
              По карману
            </button>
          </div>

          {!isOpen && <PackIllustration template={template} kind="marketClosed" label="Рынок пока закрыт" />}

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-ln px-4 py-6 text-center">
              <span className="text-sm font-semibold text-fg">Под выбранный фильтр деталей нет</span>
              <button
                type="button"
                onClick={() => {
                  onChangeSlotFilter("all");
                  setAffordableOnly(false);
                }}
                className="min-h-[40px] rounded-xl border border-ln bg-sf px-4 text-xs font-medium text-fg"
              >
                Показать все детали
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredCards.map((card) => {
                const left = stockLeftMap[card.id] ?? card.stock;
                const soldOut = left <= 0;
                const equipped = team.equippedCards[card.slotId] === card.id;
                const preview = previewCardEffect(team, card, template);
                const stepDelta = preview.stepDelta;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(card.id)}
                    className={`flex flex-col justify-between gap-2 rounded-2xl border bg-sf p-3 text-left transition active:scale-[0.99] ${
                      card.rarity === "legendary"
                        ? "border-warn/45"
                        : card.rarity === "rare"
                          ? "border-ac/35"
                          : "border-ln"
                    } ${soldOut ? "opacity-55" : "opacity-100"}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[10px] uppercase text-mu">
                          {slotLabel.get(card.slotId) ?? card.slotId}
                        </span>
                        <RarityBadge rarity={card.rarity} compact />
                      </div>

                      <div className="flex items-center justify-center rounded-xl bg-sf2/60 py-2">
                        <PartSticker card={card} template={template} thumbnail />
                      </div>

                      <p className="line-clamp-2 text-[14px] leading-snug font-semibold text-fg">
                        {card.name}
                      </p>
                      <StatDeltaList stats={template.stats} deltas={card.stats} />
                    </div>

                    <div className="flex items-center justify-between gap-1 border-t border-dashed border-ln pt-2">
                      <span className="flex items-center gap-1 font-mono text-base font-semibold text-fg">
                        {card.price}
                        <Coin size={14} />
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                          equipped
                            ? "bg-ac/15 text-ac"
                            : soldOut
                              ? "bg-sf2 text-mu"
                              : stepDelta > 0
                                ? "bg-pos/15 text-pos"
                                : stepDelta < 0
                                  ? "bg-warn/15 text-warn"
                                  : "bg-sf2 text-mu"
                        }`}
                      >
                        {equipped
                          ? "стоит"
                          : soldOut
                            ? "нет"
                            : `шаг ${stepDelta === 0 ? "=" : formatSigned(stepDelta)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {perks.length > 0 && (
            <div className="mt-3 rounded-2xl border border-ln bg-sf p-3.5">
              <h4 className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-mu">
                Спецрежимы команды
              </h4>
              <div className="mt-2.5 space-y-2">
                {perks.map((perk) => {
                  const active = team.activePerkId === perk.id;
                  const canBuyPerk =
                    isOpen && role === "captain" && !active && availableCurrency >= perk.price;
                  return (
                    <div
                      key={perk.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-sf2 p-3"
                    >
                      <PackSymbol template={template} kind="perk" id={perk.id} label={perk.name} size={36} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-semibold text-fg">{perk.name}</p>
                        <p className="text-xs leading-snug text-mu">{perk.effectText}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!canBuyPerk}
                        onClick={() => run(() => buyPerk(perk.id))}
                        className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-ac px-3 font-mono text-xs font-semibold text-acfg disabled:opacity-40"
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
        </>
      )}

      <BottomSheet
        open={Boolean(selectedCard && selectedPreview && selectedBuyState)}
        onClose={() => setSelectedCardId(null)}
        title={selectedCard?.name ?? "Деталь"}
      >
        {selectedCard && selectedPreview && selectedBuyState && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase text-mu">
                    {slotLabel.get(selectedCard.slotId) ?? selectedCard.slotId}
                  </span>
                  <RarityBadge rarity={selectedCard.rarity} />
                </div>
                <h3 className="text-[21px] leading-tight font-semibold text-fg">{selectedCard.name}</h3>
                {selectedCard.flavor && (
                  <p className="text-xs leading-relaxed text-mu">{selectedCard.flavor}</p>
                )}
                <EffectScopeBadge scope={selectedCard.effectScope} />
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[26px] leading-none font-semibold text-fg">
                {selectedCard.price}
                <Coin size={19} />
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs text-mu">Примерка на вашей сборке</span>
              <AssemblyStage
                template={template}
                equipped={team.equippedCards}
                size="card"
                preview={{ slotId: selectedCard.slotId, cardId: selectedCard.id }}
              />
            </div>

            <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl border border-dashed border-ln bg-sf p-2.5">
                <span className="font-mono text-[10px] text-mu">СЕЙЧАС</span>
                <span className="truncate text-xs font-medium text-fg">
                  {selectedPreview.replacedCard
                    ? template.features.slotInventory
                      ? `${selectedPreview.replacedCard.name} → склад`
                      : selectedPreview.replacedCard.name
                    : "пусто"}
                </span>
              </div>
              <div className="text-center font-mono text-sm text-mu">→</div>
              <div className="flex flex-col gap-0.5 rounded-xl border border-ac bg-sf p-2.5">
                <span className="font-mono text-[10px] text-ac">СТАНЕТ</span>
                <span className="truncate text-xs font-semibold text-fg">{selectedCard.name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-ln bg-sf p-3.5">
              {template.stats.map((stat) => {
                const beforeVal = selectedPreview.beforeStats.total[stat.id] ?? 0;
                const afterVal = selectedPreview.afterStats.total[stat.id] ?? 0;
                const diff = afterVal - beforeVal;
                const marks = getThresholdsForStat(template, team.activePerkId, stat.id);

                return (
                  <div key={stat.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium text-fg">
                        <StatGlyph shape={stat.shape} color={stat.color} size={11} />
                        {stat.label}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-lg leading-none font-semibold text-fg">
                          {formatStatValue(afterVal)}
                        </span>
                        {diff !== 0 && (
                          <span
                            className={`font-mono text-xs font-semibold ${diff > 0 ? "text-pos" : "text-neg"}`}
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

            <div className="flex flex-col gap-2.5 rounded-2xl border border-ln bg-sf p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-fg">Шаг за ход</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-sm text-mu line-through">
                    {selectedPreview.beforeStats.step.total}
                  </span>
                  <span className="font-mono text-xl leading-none font-semibold text-fg">
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
            </div>

            {selectedBuyState.blockHead && (
              <div className="flex items-start gap-2.5 rounded-xl border border-ln p-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45 bg-warn" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-fg">{selectedBuyState.blockHead}</span>
                  <span className="text-xs leading-snug text-mu">{selectedBuyState.blockText}</span>
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
                    const result = await proposeCard(cardToAct.id);
                    onCardProposed?.(cardToAct);
                    return result;
                  });
                } else {
                  void run(async () => {
                    const result = await buyCard(cardToAct.id);
                    onCardBought?.(cardToAct);
                    return result;
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
