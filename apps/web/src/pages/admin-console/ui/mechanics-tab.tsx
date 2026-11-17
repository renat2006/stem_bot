import type { FeatureFlags } from "@stem/shared";
import type { GameSnapshot } from "../../../entities/game/index.js";
import { updateFeatures } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { ModuleCard, ToggleSwitch } from "../../../shared/ui/index.js";
import { BalanceReport } from "../../../widgets/balance-report/index.js";

type BooleanFeatureKey = {
  [K in keyof FeatureFlags]: FeatureFlags[K] extends boolean ? K : never;
}[keyof FeatureFlags];

const FLAG_META: Array<{ key: BooleanFeatureKey; label: string; description: string }> = [
  {
    key: "p2pMarket",
    label: "Биржа между командами",
    description:
      "Команды могут выставлять свои детали на продажу другим командам в рамках честного коридора цен",
  },
  {
    key: "auctions",
    label: "Живые аукционы",
    description: "Открытые торги за редкие и легендарные модули с резервом ставки и защитой от снайпинга",
  },
  {
    key: "slotInventory",
    label: "Склад запасных деталей",
    description: "Заменённые детали сохраняются на складе команды вместо удаления",
  },
  {
    key: "storyBriefings",
    label: "Сюжетные сводки («загоны дня»)",
    description: "Показывать командам иллюстрированные ежедневные легенды и задачи раунда",
  },
  {
    key: "dayEvents",
    label: "Испытания на клетках маршрута",
    description: "Особые клетки дают бонусную валюту или проверяют характеристики при остановке",
  },
  {
    key: "catchUpBonus",
    label: "Поддержка догоняющих команд",
    description: "Команды с отставанием от лидера на 6+ клеток получают +1 к шагу",
  },
  {
    key: "perks",
    label: "Спецрежимы и свойства команд",
    description: "Разрешить покупку специальных активных режимов команды",
  },
  {
    key: "teamProposals",
    label: "Предложения от участников капитану",
    description: "Участники могут отправлять карточки на подтверждение капитану",
  },
  {
    key: "undoPurchase",
    label: "Быстрая отмена случайной покупки",
    description: "Позволяет капитану отменить последнюю покупку до конца окна рынка",
  },
];

export function MechanicsTab({ snapshot, run }: { snapshot: GameSnapshot; run: RunAction }) {
  const { template, balanceReport, liveBalance } = snapshot;
  const { features } = template;

  return (
    <div className="space-y-4">
      <BalanceReport report={balanceReport} advisor={liveBalance} run={run} />

      <ModuleCard
        title="Рубильники механик"
        subtitle="Включайте и отключайте игровые режимы прямо по ходу смены"
      >
        <div className="space-y-2.5">
          {FLAG_META.map((item) => (
            <ToggleSwitch
              key={item.key}
              checked={features[item.key]}
              onChange={(checked) => void run(() => updateFeatures({ [item.key]: checked }))}
              label={item.label}
              description={item.description}
            />
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}
