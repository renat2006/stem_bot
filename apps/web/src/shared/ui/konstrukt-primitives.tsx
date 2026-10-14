import type { StatShape } from "@stem/shared";
import type { ReactNode } from "react";

const SHAPES: Record<StatShape, string> = {
  tri: "polygon(0 0, 100% 50%, 0 100%)",
  up: "polygon(50% 0, 100% 100%, 0 100%)",
  sq: "none",
  hex: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
  dia: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
};

export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export function formatStatValue(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

export function StatGlyph({
  shape = "sq",
  color,
  size = 11,
}: {
  shape?: StatShape;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        clipPath: SHAPES[shape],
        borderRadius: shape === "sq" ? 2 : 0,
      }}
    />
  );
}

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--coin)",
        boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size / 6))}px var(--coin2)`,
      }}
    />
  );
}

export function TierBars({ tier }: { tier: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]">
      {[0, 1, 2, 3, 4].map((idx) => (
        <span
          key={idx}
          className="inline-block rounded-[1px]"
          style={{
            width: 3,
            height: 6 + idx * 2,
            background: idx < tier ? "var(--fg)" : "var(--ln)",
          }}
        />
      ))}
    </span>
  );
}

export function BuySlots({ used, limit }: { used: number; limit: number | null }) {
  const total = limit ?? 2;
  const slots = Array.from({ length: total }, (_, idx) => ({
    id: `slot-${idx + 1}`,
    isUsed: idx < used,
  }));
  return (
    <span className="inline-flex items-center gap-1">
      {slots.map((slot) => (
        <span
          key={slot.id}
          className="inline-block h-3.5 w-3.5 rounded-[4px]"
          style={{
            background: slot.isUsed ? "var(--sf2)" : "var(--ac)",
            boxShadow: slot.isUsed ? "inset 0 0 0 1.5px var(--ln)" : "none",
          }}
        />
      ))}
    </span>
  );
}

export function ModuleCard({
  title,
  subtitle,
  badge,
  onHelp,
  noPadding = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onHelp?: () => void;
  noPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ln bg-sf">
      <header className="flex min-h-[44px] items-center gap-2 border-b border-ln py-2 pr-2.5 pl-4">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-ac" />
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {subtitle && <span className="flex-1 truncate text-xs text-mu">{subtitle}</span>}
        {!subtitle && <span className="flex-1" />}
        {badge}
        {onHelp && (
          <button
            type="button"
            aria-label={`Справка: ${title}`}
            onClick={onHelp}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition active:bg-sf2"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-mu text-xs font-semibold text-mu">
              ?
            </span>
          </button>
        )}
      </header>
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--scrim)" }}
      />
      <div
        className="relative z-10 flex flex-col gap-4 overflow-y-auto rounded-t-[20px] border-t border-ln bg-bg px-4 pt-2.5"
        style={{
          maxHeight: "calc(92dvh - var(--app-safe-top))",
          paddingBottom: "calc(1.5rem + var(--app-safe-bottom))",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="w-8" />
          <div className="h-1 w-9 rounded-full bg-ln" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sf2 font-mono text-sm text-mu"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ToastWithUndo({
  text,
  canUndo,
  onUndo,
}: {
  text: string;
  canUndo?: boolean;
  onUndo?: () => void;
}) {
  return (
    <div
      className="fixed right-3 left-3 z-50 overflow-hidden rounded-xl bg-fg text-bg"
      style={{
        bottom: "calc(1rem + var(--app-safe-bottom))",
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
      }}
    >
      <div className="flex min-h-[52px] items-center gap-2.5 py-1.5 pr-2 pl-3.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ac2" />
        <span className="flex-1 text-sm leading-snug">{text}</span>
        {canUndo && onUndo && (
          <button type="button" onClick={onUndo} className="min-h-[44px] px-3 text-sm font-semibold text-ac2">
            Отменить
          </button>
        )}
      </div>
      <div className="h-[3px] w-full bg-ac2" />
    </div>
  );
}
