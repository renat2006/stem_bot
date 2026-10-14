import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-secondary text-subtitle",
  positive: "bg-positive/15 text-positive",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent/15 text-accent",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}
