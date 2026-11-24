import { Monitor, UserCheck } from "lucide-react";
import { useState } from "react";
import type { TeamMemberInfo, ViewerInfo } from "../../../entities/game/index.js";
import { getSurfaceQuery, switchDevUser } from "../../../shared/lib/index.js";

const PRESETS = [
  { id: "1:Ведущий", label: "Ведущий", surface: "admin" as const },
  { id: "101:Алиса", label: "Алиса", surface: "player" as const },
  { id: "102:Боб", label: "Боб", surface: "player" as const },
  { id: "201:Кира", label: "Кира", surface: "player" as const },
  { id: "202:Дима", label: "Дима", surface: "player" as const },
  { id: "301:Ева", label: "Ева", surface: "player" as const },
];

export function DevIdentityBar({
  viewer,
  members,
}: {
  viewer: ViewerInfo;
  members: Record<string, TeamMemberInfo[]>;
}) {
  const [open, setOpen] = useState(true);
  const known = new Map(
    Object.values(members)
      .flat()
      .map((m) => [m.userId, m.role]),
  );
  const surface = getSurfaceQuery();

  const openProjector = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "projector");
    window.location.assign(url.toString());
  };

  return (
    <div className="dev-inline-bar mx-auto mb-2 w-full max-w-[1000px] px-3 pt-2 sm:px-0 sm:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ln bg-sf px-3 py-1.5 text-xs">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[36px] items-center gap-1.5 font-bold text-mu hover:text-fg"
        >
          <UserCheck className="h-3.5 w-3.5 text-ac" />
          <span>Стенд: {viewer.displayName || "гость"}</span>
        </button>

        {open && (
          <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-ln pt-2">
            {PRESETS.map((preset) => {
              const userId = Number(preset.id.split(":")[0]);
              const active =
                viewer.userId === userId &&
                (preset.surface === "admin" ? surface === "admin" : surface !== "admin");
              const role = known.get(userId);
              return (
                <button
                  key={`${preset.id}-${preset.surface}`}
                  type="button"
                  onClick={() => switchDevUser(preset.id, preset.surface)}
                  className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    active ? "border-ac bg-ac text-acfg" : "border-ln bg-bg text-fg"
                  }`}
                >
                  {preset.label}
                  {role === "captain" ? " (кап.)" : ""}
                </button>
              );
            })}
            <button
              type="button"
              onClick={openProjector}
              className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-ln bg-sf2 px-2.5 py-1 text-xs font-bold text-fg"
            >
              <Monitor className="h-3.5 w-3.5 text-ac" />
              <span>Табло</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
