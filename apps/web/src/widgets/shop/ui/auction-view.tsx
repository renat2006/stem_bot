import { type GameTemplate, previewCardEffect } from "@stem/shared";
import { Flame, Gavel, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { AuctionLot, TeamWithStats } from "../../../entities/game/index.js";
import { placeAuctionBid } from "../../../features/purchase/index.js";
import { type RunAction, useCountdown } from "../../../shared/lib/index.js";
import { Coin, EffectScopeBadge, RarityBadge } from "../../../shared/ui/index.js";

function ActiveLotCard({
  lot,
  team,
  template,
  clockOffsetMs,
  isCaptain,
  run,
  onToast,
}: {
  lot: AuctionLot;
  team: TeamWithStats;
  template: GameTemplate;
  clockOffsetMs: number;
  isCaptain: boolean;
  run: RunAction;
  onToast?: (text: string) => void;
}) {
  const card = template.cards.find((c) => c.id === lot.cardId);
  const secondsLeft = useCountdown(lot.endsAt, clockOffsetMs);
  const minBid = lot.leaderTeamId ? lot.currentBid + 1 : lot.startingPrice;
  const [bidAmount, setBidAmount] = useState(minBid);

  useEffect(() => {
    setBidAmount((prev) => Math.max(prev, minBid));
  }, [minBid]);

  if (!card) return null;

  const isLeader = lot.leaderTeamId === team.id;
  const maxSpendable = isLeader ? team.currency : team.currency - (team.heldCurrency ?? 0);
  const canAfford = maxSpendable >= bidAmount;
  const preview = previewCardEffect(team, card, template);
  const timerText =
    secondsLeft > 0
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
      : "завершение…";

  return (
    <div className="space-y-3.5 rounded-2xl border-2 border-warn/45 bg-sf p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">
          <Flame className="h-3.5 w-3.5" />
          Открытый торг
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 font-mono text-sm font-semibold ${
            secondsLeft <= 15 ? "bg-neg/15 text-neg" : "bg-sf2 text-fg"
          }`}
        >
          {timerText}
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <PartSticker card={card} template={template} thumbnail />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <RarityBadge rarity={card.rarity} compact />
            <span className="font-mono text-xs text-mu">шаг {preview.afterStats.step.total}</span>
          </div>
          <h3 className="text-lg leading-tight font-semibold text-fg">{card.name}</h3>
          {card.flavor && <p className="text-xs text-mu">{card.flavor}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatDeltaList stats={template.stats} deltas={card.stats} size="lg" />
        <EffectScopeBadge scope={card.effectScope} />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-sf2 px-3.5 py-2.5">
        <div>
          <p className="text-[11px] text-mu">Текущая ставка</p>
          <p className="text-sm font-semibold text-fg">
            {lot.leaderTeamName
              ? isLeader
                ? "Лидирует ваша команда"
                : `Лидер: «${lot.leaderTeamName}»`
              : "Ставок пока нет"}
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-2xl font-semibold text-fg">
          {lot.currentBid}
          <Coin size={18} />
        </span>
      </div>

      {isCaptain && secondsLeft > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBidAmount((v) => Math.max(minBid, v - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-ln bg-sf2 font-mono text-lg font-semibold text-fg"
              >
                −
              </button>
              <span className="min-w-[68px] text-center font-mono text-xl font-semibold text-fg">
                {bidAmount}
              </span>
              <button
                type="button"
                onClick={() => setBidAmount((v) => v + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-ln bg-sf2 font-mono text-lg font-semibold text-fg"
              >
                +
              </button>
            </div>
            <div className="flex gap-1">
              {[1, 2, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setBidAmount(minBid + step - 1)}
                  className="h-9 rounded-lg border border-ln bg-sf2 px-2.5 font-mono text-xs font-semibold text-fg"
                >
                  +{step}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!canAfford || isLeader}
            onClick={() =>
              void run(() => placeAuctionBid(lot.id, bidAmount)).then((ok) => {
                if (ok) onToast?.(`Ставка ${bidAmount} ${template.currencyName} принята`);
              })
            }
            className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
          >
            {isLeader
              ? "Ваша ставка сейчас лучшая"
              : !canAfford
                ? `Доступно только ${maxSpendable} ${template.currencyName}`
                : `Поставить ${bidAmount} ${template.currencyName}`}
          </button>

          <p className="flex items-center gap-1.5 text-[11px] text-mu">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warn" />
            Ставка на последних 15 секундах продлевает торг до 20 секунд. При перебитии валюта сразу
            возвращается.
          </p>
        </div>
      ) : !isCaptain ? (
        <p className="rounded-xl bg-sf2 p-2.5 text-center text-xs text-mu">
          Ставки от имени команды делает капитан.
        </p>
      ) : null}
    </div>
  );
}

export function AuctionMarketView({
  auctions,
  team,
  template,
  clockOffsetMs,
  isCaptain,
  run,
  onToast,
}: {
  auctions: AuctionLot[];
  team: TeamWithStats;
  template: GameTemplate;
  clockOffsetMs: number;
  isCaptain: boolean;
  run: RunAction;
  onToast?: (text: string) => void;
}) {
  const openLots = auctions.filter((a) => a.status === "open");
  const pastLots = auctions.filter((a) => a.status !== "open").slice(0, 5);

  return (
    <div className="space-y-3">
      {openLots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ln bg-sf/60 px-4 py-7 text-center">
          <Gavel className="h-7 w-7 text-mu" />
          <p className="text-sm font-semibold text-fg">Активных аукционов сейчас нет</p>
          <p className="max-w-[260px] text-xs leading-relaxed text-mu">
            Когда ведущий выставит редкий или легендарный модуль на торги, капитаны получат уведомление.
          </p>
        </div>
      ) : (
        openLots.map((lot) => (
          <ActiveLotCard
            key={lot.id}
            lot={lot}
            team={team}
            template={template}
            clockOffsetMs={clockOffsetMs}
            isCaptain={isCaptain}
            run={run}
            onToast={onToast}
          />
        ))
      )}

      {pastLots.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-ln bg-sf p-3.5">
          <p className="font-mono text-[11px] uppercase text-mu">Завершённые лоты</p>
          {pastLots.map((lot) => {
            const card = template.cards.find((c) => c.id === lot.cardId);
            return (
              <div
                key={lot.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-sf2 px-3 py-2 text-xs"
              >
                <span className="truncate font-medium text-fg">{card?.name ?? "Редкий лот"}</span>
                <span className="shrink-0 text-mu">
                  {lot.leaderTeamName
                    ? `«${lot.leaderTeamName}» · ${lot.currentBid} ${template.currencyName}`
                    : "без ставок"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
