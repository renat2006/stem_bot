import { resolveLexicon } from "@stem/shared";
import { Settings } from "lucide-react";
import { PackIllustration } from "../../../entities/assembly/index.js";
import type { GameSnapshot } from "../../../entities/game/index.js";
import { JoinForm } from "../../../features/join-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Mark } from "../../../shared/ui/index.js";

export function JoinPage({
  snapshot,
  run,
  onJoined,
  onOpenPlayground,
  onOpenSettings,
}: {
  snapshot: GameSnapshot;
  run: RunAction;
  onJoined: () => void;
  onOpenPlayground?: () => void;
  onOpenSettings?: () => void;
}) {
  const { template, viewer } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);

  return (
    <article className="atlas-player">
      <header>
        <span className="story-btn" aria-hidden="true">
          <Mark kind="team" />
        </span>
        <span>Полевой атлас · {template.title}</span>
        <div className="header-actions">
          {template.features.offClassPlayground !== false && onOpenPlayground && (
            <button
              type="button"
              aria-label="Полигон 3 минуты"
              onClick={onOpenPlayground}
              className="atlas-icon-btn"
            >
              <Mark kind="practice" />
              <span>Тренировка</span>
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              aria-label="Настройки отображения"
              onClick={onOpenSettings}
              className="atlas-icon-btn"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="overflow-hidden rounded-lg bg-sf2">
        <PackIllustration
          template={template}
          kind="hero"
          label={lexicon.objectName}
          className="h-48 w-full object-cover"
        />
      </div>

      <div className="space-y-2">
        <h1 className="atlas-h1">Вход в команду</h1>
        <p className="atlas-lead">
          Введите код стола с карточки ведущего. Первый вошедший становится капитаном и подтверждает покупки{" "}
          {lexicon.currencyLabel.toLowerCase()}.
        </p>
      </div>

      <JoinForm
        defaultName={viewer.displayName || ""}
        devTeams={!viewer.isProduction ? snapshot.teams : undefined}
        run={run}
        onJoined={onJoined}
      />
    </article>
  );
}
