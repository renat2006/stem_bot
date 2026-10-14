import type { ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, aside, children }: SectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ln bg-sf">
      <header className="flex min-h-[44px] items-center justify-between gap-2 border-b border-ln px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-ac" />
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        </div>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
