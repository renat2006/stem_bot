export type IconName = "team" | "market" | "track" | "rules";

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label}
      className="shrink-0"
    >
      <use href={`/art/icons.svg#i-${name}`} />
    </svg>
  );
}
