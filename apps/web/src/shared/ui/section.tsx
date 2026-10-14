import type { ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, aside, children }: SectionProps) {
  return (
    <section className="rounded-2xl bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {aside}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}
