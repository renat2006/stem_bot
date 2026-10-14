import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-sf2 text-mu border border-ln",
  positive: "bg-pos/15 text-pos border border-pos/30",
  destructive: "bg-neg/15 text-neg border border-neg/30",
  accent: "bg-ac/15 text-ac border border-ac/30",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
