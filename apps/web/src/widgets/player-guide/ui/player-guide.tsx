import type { GameTemplate } from "@stem/shared";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useState } from "react";
import { PackIllustration, PartSticker } from "../../../entities/assembly/index.js";
import { useTelegram } from "../../../shared/lib/index.js";
import { StatImpactPills } from "../../../shared/ui/index.js";
import "./player-guide.css";

export function PlayerGuide({
  template,
  teamName,
  onDone,
}: {
  template: GameTemplate;
  teamName: string;
  onDone: () => void;
}) {
  const { hapticTap, hapticSuccess } = useTelegram();
  const [page, setPage] = useState(0);
  const [choice, setChoice] = useState(0);
  const samples = template.cards.filter((c) => c.dayAvailable === 1).slice(0, 2);
  const card = samples[choice] ?? template.cards[0];
  const animal = template.objectRig === "creature";
  const title = [template.title, "Примерьте деталь", "Ваш ход в раунде"][page];

  return (
    <section className="fieldguide" aria-label="Знакомство с игрой">
      <header>
        <div className="min-w-0">
          <span className="block truncate text-fg">Команда «{teamName}»</span>
        </div>
        <button
          type="button"
          className="guideskip"
          onClick={() => {
            hapticTap();
            onDone();
          }}
        >
          Пропустить
        </button>
      </header>
      <div className="guideplate" key={page}>
        {page === 0 ? (
          <PackIllustration
            template={template}
            kind="hero"
            label={template.objectName}
            className="guidecover"
          />
        ) : page === 1 && card ? (
          <div className="guidestudy">
            <PartSticker card={card} template={template} />
            <strong className="text-sm font-bold text-fg">{card.name}</strong>
          </div>
        ) : (
          <div className="guidefinish">
            <Flag size={28} className="text-ac" />
            <div>
              {[template.trackMax - 2, template.trackMax - 1, template.trackMax].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <b className="text-sm font-bold text-fg">{template.trackName}</b>
          </div>
        )}
      </div>
      <div className="guidebody">
        <div
          className="guideprogress"
          role="progressbar"
          aria-label="Знакомство с игрой"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={page + 1}
        >
          {["Цель", "Сборка", "Поле"].map((v, i) => (
            <span key={v} data-current={i === page}>
              {v}
            </span>
          ))}
        </div>
        <h1>{title}</h1>
        {page === 0 ? (
          <p>
            Доведите фишку команды до отметки {template.trackMax}. На занятиях наставник начисляет{" "}
            {template.currencyName} за выполненную работу, а в мастерской вы собираете{" "}
            {animal ? "части тела существа" : "узлы командной модели"}.
          </p>
        ) : page === 1 && card ? (
          <>
            <p>
              Выберите модуль и сравните влияние на характеристики. Покупку в мастерской подтверждает капитан.
            </p>
            <div className="guidechoices">
              {samples.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  aria-pressed={i === choice}
                  onClick={() => {
                    hapticTap();
                    setChoice(i);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-3" aria-live="polite">
              <StatImpactPills stats={template.stats} deltas={card.stats} />
            </div>
          </>
        ) : (
          <p>
            {animal
              ? "Бросьте кубик и передвиньте фишку по Квадрату событий: характеристики определят исход испытания."
              : "В раунде каждый участник команды управляет своим рычагом маршрута и резерва на телефоне."}{" "}
            После вскрытия условия среды команды продвигаются к финишу.
          </p>
        )}
        <footer>
          {page > 0 && (
            <button
              type="button"
              aria-label="Назад"
              onClick={() => {
                hapticTap();
                setPage(page - 1);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button
            className="guideprimary"
            type="button"
            onClick={() => {
              if (page === 2) {
                hapticSuccess();
                onDone();
              } else {
                hapticTap();
                setPage(page + 1);
              }
            }}
          >
            <span>{["Посмотреть детали", "Как сделать ход", "К моей команде"][page]}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      </div>
    </section>
  );
}
