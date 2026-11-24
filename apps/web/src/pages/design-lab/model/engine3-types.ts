import {
  type GameTemplate,
  NEURO_AIRSHIP_TEMPLATE,
  NEUROFAUNA_TEMPLATE,
  ROVER_SPRINT_TEMPLATE,
  STARTUP_DAY_TEMPLATE,
} from "@stem/shared";

export type RoundEngineType = "mission" | "diagnosis" | "legacy_track";
export type WorldKey = "rovers" | "neurofauna" | "airship" | "startup";
export type DesignStyle = "a" | "b" | "c" | "cjm";
export type SurfaceMode = "player" | "admin" | "split" | "projector";

export type PlayerPhaseId = "e0" | "e1" | "e2" | "e3a" | "e3b" | "e3c" | "e4" | "e5";
export type ProjectorMode = "build" | "program" | "reveal";
export type AdminMode = "live" | "constructor";

export interface TemplateLexicon {
  objectName: string;
  currencyLabel: string;
  currencyUnit: string;
  reserveLabel: string;
  environmentLabel: string;
  programLabel: string;
  diagnosisLabel: string;
  circuitLabel: string;
  extraRiskLabel: string;
  sectorALabel: string;
  sectorBLabel: string;
  workshopNoun: string;
}

export interface MissionRouteOption {
  id: string;
  label: string;
  statId: string;
  min: number;
  bonusPoints: number;
  requiredTag?: string;
  tagCardName?: string;
  loadCost: number;
}

export interface MissionConditionOption {
  id: string;
  label: string;
  delta: number;
  weight: number;
}

export interface MissionDayConfig {
  type: "mission";
  day: number;
  title: string;
  routesA: MissionRouteOption[];
  deliveryB: { label: string; statId: string; min: number };
  conditions: MissionConditionOption[];
  transferPrompt: string;
}

export interface DiagnosisHypothesis {
  id: string;
  label: string;
  explanation: string;
}

export interface DiagnosisProbe {
  id: string;
  label: string;
  resultByHypothesis: Record<string, string>;
}

export interface DiagnosisDayConfig {
  type: "diagnosis";
  day: number;
  title: string;
  symptom: string;
  hypotheses: DiagnosisHypothesis[];
  probes: DiagnosisProbe[];
  secretHypothesisId: string;
  maxProbes: number;
  transferPrompt: string;
}

export interface PowerCircuitConfig {
  enabled: boolean;
  baseCapacity: number;
  maxOverloadPerStep: number;
  maxAccumulatedHeat: number;
  pauseCooling: number;
}

export interface Engine3Addons {
  powerCircuit: boolean;
  actionTags: boolean;
  openMilestones: boolean;
  offClassPlayground: boolean;
}

export interface MissionTeamOrders {
  routeId: string;
  paceA: "normal" | "fast" | "pause";
  paceB: "normal" | "fast" | "pause";
  extraCargo: boolean;
  reserveTarget: "A" | "B";
}

export interface SectorEval {
  resource: number;
  threshold: number;
  passed: boolean;
  points: number;
  peakLoad: number;
  heatAfter: number;
  trippedCircuit: boolean;
}

export interface MissionRunOutcome {
  condition: MissionConditionOption;
  probabilityPercent: number;
  sectorA: SectorEval;
  sectorB: SectorEval;
  totalPoints: number;
  currencyDelta: 0;
  counterfactual: {
    changeLabel: string;
    altPoints: number;
    tradeoffText: string;
  };
}

export interface CrewMemberSlot {
  slotIndex: 0 | 1 | 2 | 3 | 4;
  memberName: string;
  controlLabel: string;
  debateHint: string;
  lockedReady: boolean;
  pinged: boolean;
}

export interface ClassroomTeam3 {
  id: string;
  name: string;
  monogram: string;
  code: string;
  budget: number;
  totalSeasonPoints: number;
  lastRoundPoints: number;
  purchasesToday: number;
  readyPhones: number;
  totalPhones: number;
  baseStats: Record<string, number>;
  equipped: Record<string, string | null>;
  warehouse: string[];
  orders: MissionTeamOrders;
}

export interface WorldPack3 {
  key: WorldKey;
  template: GameTemplate;
  accentHex: string;
  accentSecondaryHex: string;
  lexicon: TemplateLexicon;
  cardTags: Record<string, { tag: string; badgeLabel: string; load: number }>;
  missionDay: MissionDayConfig;
  diagnosisDay: DiagnosisDayConfig;
  starterEquipped: Record<string, string | null>;
  starterWarehouse: string[];
  teamNames: Array<{ name: string; mono: string; code: string }>;
}

export const WORLD_PACKS_3: Record<WorldKey, WorldPack3> = {
  rovers: {
    key: "rovers",
    template: ROVER_SPRINT_TEMPLATE,
    accentHex: "#ff5a1f",
    accentSecondaryHex: "#f59e0b",
    lexicon: {
      objectName: "Ровер-доставщик",
      currencyLabel: "Энергоячейки",
      currencyUnit: "ед.",
      reserveLabel: "Аварийный бустер",
      environmentLabel: "Погода полигона",
      programLabel: "Программа заезда",
      diagnosisLabel: "Диагностика узла",
      circuitLabel: "Ток и нагрев шины",
      extraRiskLabel: "Второй контейнер",
      sectorALabel: "Участок A · Подход",
      sectorBLabel: "Участок B · Терминал",
      workshopNoun: "реальном шасси в лаборатории",
    },
    cardTags: {
      "kevlar-tracks": { tag: "tracked", badgeLabel: "Траки: траверс склона", load: 2 },
      "klann-walker": { tag: "tracked", badgeLabel: "Шагающий ход: траверс", load: 2 },
      "stereo-lidar": { tag: "autonomous", badgeLabel: "Лидар: слепой коридор", load: 2 },
      "scissor-lift-arm": { tag: "lift", badgeLabel: "Манипулятор: шлюз", load: 2 },
    },
    missionDay: {
      type: "mission",
      day: 4,
      title: "День 4 · Доставьте контейнер через гряду",
      routesA: [
        {
          id: "short",
          label: "Короткий гребень",
          statId: "traction",
          min: 7,
          bonusPoints: 1,
          loadCost: 2,
        },
        {
          id: "detour",
          label: "Пологий объезд",
          statId: "speed",
          min: 4,
          bonusPoints: 0,
          loadCost: 1,
        },
        {
          id: "tag_special",
          label: "Траверс по осыпи",
          statId: "traction",
          min: 5,
          bonusPoints: 1,
          requiredTag: "tracked",
          tagCardName: "Шагающий ход / Гусеницы",
          loadCost: 2,
        },
      ],
      deliveryB: { label: "Подъём груза на шлюз", statId: "payload", min: 4 },
      conditions: [
        { id: "calm", label: "Плотный наст", delta: 0, weight: 1 },
        { id: "storm", label: "Зыбучий нанос", delta: 2, weight: 1 },
      ],
      transferPrompt:
        "Какой один измеримый параметр (ток мотора, клиренс или угол въезда) вы замерите на своём физическом ровере до конца занятия?",
    },
    diagnosisDay: {
      type: "diagnosis",
      day: 3,
      title: "День 3 · Срыв курса в узком коридоре",
      symptom:
        "На втором метре трассы ровер резко уводит вправо перед белой стенкой, хотя на старте обе гусеницы крутились ровно.",
      hypotheses: [
        {
          id: "h1",
          label: "Засветка ИК-датчика бликом",
          explanation: "Лампа зала даёт ложный контраст на глянцевом участке поля.",
        },
        {
          id: "h2",
          label: "Просадка шины питания под пиком",
          explanation: "При одновременном рывке сервопривода перезагружается контроллер.",
        },
        {
          id: "h3",
          label: "Проскальзывание правой ступицы",
          explanation: "Ослаб винт фиксации вала правого редуктора под нагрузкой.",
        },
        {
          id: "h4",
          label: "Перерегулирование ПИД-коэффициента",
          explanation: "Слишком высокий дифференциальный отклик раскачивает руление.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Проверить, исчезает ли увод без отражений",
          resultByHypothesis: { h1: "Увод исчез", h2: "Увод исчез", h3: "Увод остался", h4: "Увод остался" },
        },
        {
          id: "p2",
          label: "Проверить движение с постоянной командой",
          resultByHypothesis: { h1: "Идёт прямо", h2: "Отклоняется", h3: "Идёт прямо", h4: "Отклоняется" },
        },
      ],
      secretHypothesisId: "h3",
      maxProbes: 2,
      transferPrompt:
        "Какой один быстрый контрольный тест вы проведёте перед заездом, чтобы отсечь механику от кода за 60 секунд?",
    },
    starterEquipped: {
      chassis: "articulated-deck",
      drive: "printed-lug-wheels",
      sensors: "ir-line-array",
      power: "li-ion-2s",
      cargo: "cargo-tray",
      firmware: null,
    },
    starterWarehouse: ["slick-wheels", "klann-walker"],
    teamNames: [
      { name: "Кратер", mono: "КР", code: "KR-01" },
      { name: "Импульс", mono: "ИМ", code: "IM-02" },
      { name: "Базальт", mono: "БЗ", code: "BZ-03" },
      { name: "Зенит", mono: "ЗН", code: "ZN-04" },
      { name: "Перигей", mono: "ПР", code: "PR-05" },
      { name: "Титан", mono: "ТТ", code: "TT-06" },
      { name: "Азимут", mono: "АЗ", code: "AZ-07" },
      { name: "Вектор", mono: "ВК", code: "VK-08" },
      { name: "Кварц", mono: "КВ", code: "KV-09" },
      { name: "Альтаир", mono: "АЛ", code: "AL-10" },
    ],
  },

  neurofauna: {
    key: "neurofauna",
    template: NEUROFAUNA_TEMPLATE,
    accentHex: "#10b981",
    accentSecondaryHex: "#14b8a6",
    lexicon: {
      objectName: "Биовид",
      currencyLabel: "Очки ДНК",
      currencyUnit: "ДНК",
      reserveLabel: "Выброс адреналина",
      environmentLabel: "Сдвиг биома",
      programLabel: "План миграции",
      diagnosisLabel: "Биодиагностика",
      circuitLabel: "Метаболический перегрев",
      extraRiskLabel: "Крупная добыча",
      sectorALabel: "Ареал A · Переход",
      sectorBLabel: "Ареал B · Гнездовье",
      workshopNoun: "модели экосистемы команды",
    },
    cardTags: {
      "phoenix-wings": { tag: "flight", badgeLabel: "Крылья: перелёт каньона", load: 2 },
      "turtle-shell": { tag: "armor", badgeLabel: "Панцирь: защита в зной", load: 1 },
    },
    missionDay: {
      type: "mission",
      day: 4,
      title: "День 4 · Проведите стаю через плато",
      routesA: [
        {
          id: "short",
          label: "Прямой каньон",
          statId: "strength",
          min: 7,
          bonusPoints: 1,
          loadCost: 2,
        },
        {
          id: "detour",
          label: "Ночная тропа",
          statId: "speed",
          min: 4,
          bonusPoints: 0,
          loadCost: 1,
        },
        {
          id: "tag_special",
          label: "Планирующий поток",
          statId: "speed",
          min: 5,
          bonusPoints: 1,
          requiredTag: "flight",
          tagCardName: "Крылья феникса",
          loadCost: 2,
        },
      ],
      deliveryB: { label: "Закрепление в оазисе", statId: "survival", min: 4 },
      conditions: [
        { id: "calm", label: "Утренняя роса", delta: 0, weight: 1 },
        { id: "storm", label: "Пик засухи", delta: 2, weight: 1 },
      ],
      transferPrompt:
        "Какой один компромисс между скоростью и защитой в вашей биологической модели вы проверите расчётом сегодня?",
    },
    diagnosisDay: {
      type: "diagnosis",
      day: 3,
      title: "День 3 · Резкое падение активности популяции",
      symptom:
        "Вид успешно проходит дневной переход, но теряет тонус у воды при появлении соседних хищников.",
      hypotheses: [
        {
          id: "h1",
          label: "Перегрев под тёмным панцирем",
          explanation: "Избыток теплоёмкости без ночного охлаждения.",
        },
        {
          id: "h2",
          label: "Дефицит солей в рационе",
          explanation: "Быстрый обмен веществ истощает водный резерв.",
        },
        {
          id: "h3",
          label: "Слепая зона бокового зрения",
          explanation: "Сенсорика настроена только на прямую погоню.",
        },
        {
          id: "h4",
          label: "Высокая энергоцена тяжёлых клешней",
          explanation: "Масса конечностей гасит рывок на мягком иле.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Сравнить активность в прохладе",
          resultByHypothesis: {
            h1: "Активность выше",
            h2: "Активность выше",
            h3: "Без изменения",
            h4: "Без изменения",
          },
        },
        {
          id: "p2",
          label: "Сравнить реакцию на твёрдой опоре",
          resultByHypothesis: {
            h1: "Отклик быстрее",
            h2: "Без изменения",
            h3: "Отклик быстрее",
            h4: "Без изменения",
          },
        },
      ],
      secretHypothesisId: "h4",
      maxProbes: 2,
      transferPrompt:
        "Какое одно контрольное наблюдение однозначно отделит нехватку энергии от ошибки восприятия?",
    },
    starterEquipped: {
      head: "lion-head",
      body: "lion-body",
      front: "scorpion-claws",
      back: "cheetah-paws",
      tail: null,
      special: "turtle-shell",
    },
    starterWarehouse: ["shark-body", "phoenix-wings"],
    teamNames: [
      { name: "Химера", mono: "ХМ", code: "HM-01" },
      { name: "Апекс", mono: "АП", code: "AP-02" },
      { name: "Панцирь", mono: "ПН", code: "PN-03" },
      { name: "Стая", mono: "СТ", code: "ST-04" },
      { name: "Мантис", mono: "МН", code: "MN-05" },
      { name: "Кобра", mono: "КБ", code: "KB-06" },
      { name: "Грифон", mono: "ГР", code: "GR-07" },
      { name: "Наутилус", mono: "НТ", code: "NT-08" },
      { name: "Сапсан", mono: "СП", code: "SP-09" },
      { name: "Симбионт", mono: "СМ", code: "SM-10" },
    ],
  },

  airship: {
    key: "airship",
    template: NEURO_AIRSHIP_TEMPLATE,
    accentHex: "#0ea5e9",
    accentSecondaryHex: "#38bdf8",
    lexicon: {
      objectName: "Нейро-дирижабль",
      currencyLabel: "Заряды",
      currencyUnit: "зар.",
      reserveLabel: "Форсаж винтов",
      environmentLabel: "Ветровой сдвиг",
      programLabel: "Полётное задание",
      diagnosisLabel: "Диагностика борта",
      circuitLabel: "Разряд и крен гондолы",
      extraRiskLabel: "Доп. метеозонд",
      sectorALabel: "Эшелон A · Набор",
      sectorBLabel: "Эшелон B · Точка сброса",
      workshopNoun: "стендовом дирижабле вашей группы",
    },
    cardTags: {
      "reinforced-hull": { tag: "stormproof", badgeLabel: "Купол: вход в турбулентность", load: 2 },
    },
    missionDay: {
      type: "mission",
      day: 4,
      title: "День 4 · Удержите дирижабль над целью",
      routesA: [
        {
          id: "short",
          label: "Восходящий поток",
          statId: "neurocontrol",
          min: 7,
          bonusPoints: 1,
          loadCost: 2,
        },
        {
          id: "detour",
          label: "Спокойный коридор",
          statId: "aerodynamics",
          min: 4,
          bonusPoints: 0,
          loadCost: 1,
        },
      ],
      deliveryB: { label: "Удержание над маяком", statId: "reliability", min: 4 },
      conditions: [
        { id: "calm", label: "Ламинарный поток", delta: 0, weight: 1 },
        { id: "storm", label: "Боковой порыв", delta: 2, weight: 1 },
      ],
      transferPrompt: "Какой один параметр балансировки гондолы вы проверите перед реальным запуском в зале?",
    },
    diagnosisDay: {
      type: "diagnosis",
      day: 3,
      title: "День 3 · Потеря удержания высоты у маяка",
      symptom: "Аппарат выходит на точку, но начинает плавно рыскать по курсу каждые 4 секунды.",
      hypotheses: [
        { id: "h1", label: "Шум в канале нейрогарнитуры", explanation: "Неотфильтрованная наводка 50 Гц." },
        {
          id: "h2",
          label: "Смещение центра масс вперёд",
          explanation: "Аккумулятор сдвинулся в нос гондолы.",
        },
        { id: "h3", label: "Разбаланс тяги левого импеллера", explanation: "Просели обороты одного мотора." },
        {
          id: "h4",
          label: "Тепловой поток от прожектора",
          explanation: "Локальный восходящий столб у стены.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Измерить крен при подвесе за центр",
          resultByHypothesis: {
            h1: "Крен сохраняется",
            h2: "Крен сохраняется",
            h3: "Корпус выровнен",
            h4: "Корпус выровнен",
          },
        },
        {
          id: "p2",
          label: "Сравнить тягу на стенде",
          resultByHypothesis: {
            h1: "Тяга различается",
            h2: "Тяга одинакова",
            h3: "Тяга различается",
            h4: "Тяга одинакова",
          },
        },
      ],
      secretHypothesisId: "h3",
      maxProbes: 2,
      transferPrompt: "Как за 1 минуту на старте проверить равенство тяги моторов без сложного стенда?",
    },
    starterEquipped: {
      envelope: "reinforced-hull",
      gondola: null,
      propulsion: null,
      stabilizer: null,
      bci: null,
      telemetry: null,
    },
    starterWarehouse: ["mylar-hull"],
    teamNames: [
      { name: "Стратос", mono: "СТ", code: "ST-01" },
      { name: "Зефир", mono: "ЗФ", code: "ZF-02" },
      { name: "Альтитуда", mono: "АЛ", code: "AL-03" },
      { name: "Борей", mono: "БР", code: "BR-04" },
    ],
  },

  startup: {
    key: "startup",
    template: STARTUP_DAY_TEMPLATE,
    accentHex: "#8b5cf6",
    accentSecondaryHex: "#ec4899",
    lexicon: {
      objectName: "Продукт команды",
      currencyLabel: "Инвестиции",
      currencyUnit: "кред.",
      reserveLabel: "Спринт-фокус",
      environmentLabel: "Реакция рынка",
      programLabel: "План релиза",
      diagnosisLabel: "Аудит воронки",
      circuitLabel: "Техдолг и выгорание",
      extraRiskLabel: "Премиум-контракт",
      sectorALabel: "Этап A · Запуск",
      sectorBLabel: "Этап B · Удержание",
      workshopNoun: "прототипе вашего стартапа",
    },
    cardTags: {
      "enterprise-sdk": { tag: "b2b", badgeLabel: "SDK: прямой B2B-пилот", load: 2 },
    },
    missionDay: {
      type: "mission",
      day: 2,
      title: "Запустите пилот для клиента",
      routesA: [
        {
          id: "short",
          label: "Резкий виральный старт",
          statId: "innovation",
          min: 7,
          bonusPoints: 1,
          loadCost: 2,
        },
        {
          id: "detour",
          label: "Закрытая бета",
          statId: "growth",
          min: 4,
          bonusPoints: 0,
          loadCost: 1,
        },
      ],
      deliveryB: { label: "SLA и защита данных", statId: "stability", min: 4 },
      conditions: [
        { id: "calm", label: "Лояльный заказчик", delta: 0, weight: 1 },
        { id: "storm", label: "Аудит безопасности", delta: 2, weight: 1 },
      ],
      transferPrompt: "Какую одну метрику ценности вы проверите на первых 5 пользователях до питча?",
    },
    diagnosisDay: {
      type: "diagnosis",
      day: 3,
      title: "Раунд 3 · Обвал конверсии на втором шаге",
      symptom: "80% пользователей открывают экран создания проекта, но только 9% доходят до первой отправки.",
      hypotheses: [
        {
          id: "h1",
          label: "Обязательная форма из 9 полей на входе",
          explanation: "Высокий порог трения до ценности.",
        },
        {
          id: "h2",
          label: "Таймаут API генерации свыше 12 секунд",
          explanation: "Клиенты закрывают вкладку на спиннере.",
        },
        { id: "h3", label: "Непонятный тарифный пейволл", explanation: "Страх списания до теста." },
        { id: "h4", label: "Баг вёрстки кнопки на iOS Safari", explanation: "Клавиатура перекрывает CTA." },
      ],
      probes: [
        {
          id: "p1",
          label: "Сравнить завершение шага на телефоне и ноутбуке",
          resultByHypothesis: {
            h1: "Есть разница",
            h2: "Есть разница",
            h3: "Разницы нет",
            h4: "Разницы нет",
          },
        },
        {
          id: "p2",
          label: "Повторить тест с локальным ответом",
          resultByHypothesis: {
            h1: "Конверсия выше",
            h2: "Без изменения",
            h3: "Конверсия выше",
            h4: "Без изменения",
          },
        },
      ],
      secretHypothesisId: "h4",
      maxProbes: 2,
      transferPrompt: "Какой один срез аналитики вы посмотрите первым, прежде чем переписывать фичу?",
    },
    starterEquipped: {
      prod: "mvp-weekend",
      team: null,
      mkt: null,
      fin: null,
      tech: null,
    },
    starterWarehouse: ["enterprise-sdk"],
    teamNames: [
      { name: "Нова", mono: "НВ", code: "NV-01" },
      { name: "Пulсар", mono: "ПЛ", code: "PL-02" },
      { name: "Квантум", mono: "КВ", code: "KV-03" },
      { name: "Синтез", mono: "СН", code: "SN-04" },
    ],
  },
};

export function evaluateMissionOutcome(params: {
  stats: Record<string, number>;
  day: MissionDayConfig;
  orders: MissionTeamOrders;
  condition: MissionConditionOption;
  totalWeight: number;
  circuit: PowerCircuitConfig;
  equippedLoad: number;
}): MissionRunOutcome {
  const { stats, day, orders, condition, totalWeight, circuit, equippedLoad } = params;
  const route = day.routesA.find((r) => r.id === orders.routeId) ?? day.routesA[0];
  if (!route) {
    throw new Error("Mission route configuration is empty");
  }

  const aFast = orders.paceA === "fast" ? 1 : 0;
  const bFast = orders.paceB === "fast" ? 1 : 0;
  const extraC = orders.extraCargo ? 1 : 0;

  const resA = (stats[route.statId] ?? 0) + (orders.reserveTarget === "A" ? 2 : 0);
  const thrA = route.min + 2 * aFast;

  const actionLoadA = orders.paceA === "pause" ? 0 : route.loadCost + aFast;
  const peakA = equippedLoad + actionLoadA;
  const overloadA = Math.max(0, peakA - circuit.baseCapacity);
  const coolA = orders.paceA === "pause" ? circuit.pauseCooling : 0;
  const heatA = circuit.enabled ? Math.max(0, overloadA - coolA) : 0;
  const tripA =
    circuit.enabled && (overloadA > circuit.maxOverloadPerStep || heatA > circuit.maxAccumulatedHeat);

  const passA = orders.paceA !== "pause" && !tripA && resA >= thrA;
  const ptsA = passA ? 1 + aFast + route.bonusPoints : 0;

  const resB = (stats[day.deliveryB.statId] ?? 0) + (orders.reserveTarget === "B" ? 2 : 0);
  const thrB = day.deliveryB.min + 2 * bFast + 2 * extraC + condition.delta;

  const actionLoadB = orders.paceB === "pause" ? 0 : 1 + bFast + extraC;
  const peakB = equippedLoad + actionLoadB;
  const overloadB = Math.max(0, peakB - circuit.baseCapacity);
  const coolB = orders.paceB === "pause" ? circuit.pauseCooling : 0;
  const heatB = circuit.enabled ? Math.max(0, heatA + overloadB - coolB) : 0;
  const tripB =
    circuit.enabled && (overloadB > circuit.maxOverloadPerStep || heatB > circuit.maxAccumulatedHeat);

  const passB = orders.paceB !== "pause" && !tripB && resB >= thrB;
  const ptsB = passB ? 1 + bFast + 2 * extraC : 0;

  const totalPoints = ptsA + ptsB;

  const flippedReserve: "A" | "B" = orders.reserveTarget === "A" ? "B" : "A";
  const altResA = (stats[route.statId] ?? 0) + (flippedReserve === "A" ? 2 : 0);
  const altPassA = orders.paceA !== "pause" && !tripA && altResA >= thrA;
  const altPtsA = altPassA ? 1 + aFast + route.bonusPoints : 0;

  const altResB = (stats[day.deliveryB.statId] ?? 0) + (flippedReserve === "B" ? 2 : 0);
  const altPassB = orders.paceB !== "pause" && !tripB && altResB >= thrB;
  const altPtsB = altPassB ? 1 + bFast + 2 * extraC : 0;
  const altTotal = altPtsA + altPtsB;

  const probabilityPercent = Math.round((condition.weight / Math.max(1, totalWeight)) * 100);

  return {
    condition,
    probabilityPercent,
    sectorA: {
      resource: resA,
      threshold: thrA,
      passed: passA,
      points: ptsA,
      peakLoad: peakA,
      heatAfter: heatA,
      trippedCircuit: tripA,
    },
    sectorB: {
      resource: resB,
      threshold: thrB,
      passed: passB,
      points: ptsB,
      peakLoad: peakB,
      heatAfter: heatB,
      trippedCircuit: tripB,
    },
    totalPoints,
    currencyDelta: 0,
    counterfactual: {
      changeLabel: `Если направить резерв (+2) в участок ${flippedReserve}`,
      altPoints: altTotal,
      tradeoffText:
        altTotal > totalPoints
          ? `Итог вырос бы до +${altTotal} очк., но участок ${orders.reserveTarget} остался бы без запаса прочности.`
          : altTotal < totalPoints
            ? `Итог снизился бы до +${altTotal} очк. — ваше распределение резерва оказалось оптимальным.`
            : `Итог остался бы +${altTotal} очк., сместив риск между секторами A и B.`,
    },
  };
}
