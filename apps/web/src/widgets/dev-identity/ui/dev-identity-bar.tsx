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
    <div className="mb-3 rounded-xl border border-dashed border-warn/50 bg-warn/5 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <p className="truncate font-mono text-[11px] text-warn">
          ТЕСТ · {viewer.displayName || "гость"}
          {viewer.isAdmin ? " · ведущий" : ""}
          {viewer.role ? ` · ${viewer.role === "captain" ? "капитан" : "участник"}` : ""}
        </p>
        <button
          type="button"
          onClick={openProjector}
          className="shrink-0 rounded-md border border-ln bg-sf px-2 py-0.5 font-mono text-[10px] font-medium text-fg"
        >
          Табло 16:9
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
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
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                active ? "border-ac bg-ac/15 text-fg" : "border-ln bg-sf text-mu"
              }`}
            >
              {preset.label}
              {role ? (role === "captain" ? " ★" : " •") : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
