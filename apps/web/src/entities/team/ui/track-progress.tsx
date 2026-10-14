interface TrackProgressProps {
  label: string;
  position: number;
  max: number;
}

export function TrackProgress({ label, position, max }: TrackProgressProps) {
  const percent = Math.min(100, (position / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-hint">
        <span>{label}</span>
        <span>
          {position} / {max}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-button transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
