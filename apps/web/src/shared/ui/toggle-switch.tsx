export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ln bg-sf p-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-snug text-mu">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:opacity-45 ${
          checked ? "border-ac bg-ac" : "border-ln bg-sf2"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-sf shadow-xs transition-transform ${
            checked ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
