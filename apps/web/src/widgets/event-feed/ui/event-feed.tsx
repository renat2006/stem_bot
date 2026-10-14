import type { FeedEntry, TeamWithStats } from "../../../entities/game/index.js";
import { ModuleCard } from "../../../shared/ui/index.js";

interface EventFeedProps {
  feed: FeedEntry[];
  teams: TeamWithStats[];
  title?: string;
  emptyText?: string;
}

const TIME = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function EventFeed({
  feed,
  teams,
  title = "Журнал",
  emptyText = "Пока ничего не произошло",
}: EventFeedProps) {
  const names = new Map(teams.map((t) => [t.id, t.name]));
  return (
    <ModuleCard title={title}>
      {feed.length === 0 ? (
        <p className="text-sm text-mu">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {feed.map((entry) => (
            <li
              key={entry.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 rounded-lg bg-sf2 px-3 py-2"
            >
              <span className="font-mono text-[11px] text-mu">{TIME.format(new Date(entry.createdAt))}</span>
              <span className="text-[13px] leading-snug text-fg">
                {entry.teamId && names.get(entry.teamId) ? (
                  <span className="font-semibold">{names.get(entry.teamId)}: </span>
                ) : null}
                {entry.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ModuleCard>
  );
}
