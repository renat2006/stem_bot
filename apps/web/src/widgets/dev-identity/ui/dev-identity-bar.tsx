import type { TeamMemberInfo, ViewerInfo } from "../../../entities/game/index.js";
import { switchDevUser } from "../../../shared/lib/index.js";

const PRESETS = [
  { id: "1:Ведущий", label: "Ведущий" },
  { id: "101:Алиса", label: "Алиса" },
  { id: "102:Боб", label: "Боб" },
  { id: "201:Кира", label: "Кира" },
  { id: "202:Дима", label: "Дима" },
  { id: "301:Ева", label: "Ева" },
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
  return (
    <div className="mb-3 rounded-xl border border-dashed border-warn/50 bg-warn/5 p-2">
      <p className="mb-1.5 px-1 font-mono text-[11px] text-warn">
        DEV · вы: {viewer.displayName || "аноним"} ({viewer.userId ?? "—"}){viewer.isAdmin ? " · админ" : ""}
        {viewer.role ? ` · ${viewer.role === "captain" ? "капитан" : "участник"}` : ""}
      </p>
      <div className="flex gap-1.5 overflow-x-auto">
        {PRESETS.map((preset) => {
          const userId = Number(preset.id.split(":")[0]);
          const active = viewer.userId === userId;
          const role = known.get(userId);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => switchDevUser(preset.id)}
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
