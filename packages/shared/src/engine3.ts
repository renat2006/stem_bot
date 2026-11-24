import { calculateTeamStats } from "./engine.js";
import type {
  DayScheduleItem,
  DiagnosisDayConfig,
  GameTemplate,
  MissionConditionOption,
  MissionDayConfig,
  MissionTeamOrders,
  RoundEngineType,
  Team,
  TemplateLexicon,
} from "./schema.js";

export interface PowerCircuitConfig {
  enabled: boolean;
  baseCapacity: number;
  maxOverloadPerStep: number;
  maxAccumulatedHeat: number;
  pauseCooling: number;
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

export interface ParetoCheckResult {
  balanced: boolean;
  currentMinA: number;
  suggestedMinA: number;
  safeScores: number[];
  riskScores: number[];
  conditionLabels: string[];
  summary: string;
}

const DEFAULT_LEXICONS: Record<GameTemplate["eventKey"], TemplateLexicon> = {
  rovers: {
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
    workshopNoun: "реальном шасси на стенде",
  },
  neurofauna: {
    objectName: "Существо",
    currencyLabel: "Очки ДНК",
    currencyUnit: "ДНК",
    reserveLabel: "Запас адреналина",
    environmentLabel: "Сдвиг биома",
    programLabel: "План миграции",
    diagnosisLabel: "Биодиагностика",
    circuitLabel: "Метаболическая нагрузка",
    extraRiskLabel: "Крупная добыча",
    sectorALabel: "Ареал A · Переход",
    sectorBLabel: "Ареал B · Гнездовье",
    workshopNoun: "биологической модели команды",
  },
  airship: {
    objectName: "Нейро-дирижабль",
    currencyLabel: "Заряды",
    currencyUnit: "зар.",
    reserveLabel: "Форсаж винтов",
    environmentLabel: "Ветровой сдвиг",
    programLabel: "Полётное задание",
    diagnosisLabel: "Диагностика борта",
    circuitLabel: "Разряд и крен оболочки",
    extraRiskLabel: "Доп. метеозонд",
    sectorALabel: "Эшелон A · Набор",
    sectorBLabel: "Эшелон B · Точка сброса",
    workshopNoun: "стендовом дирижабле группы",
  },
  startup: {
    objectName: "Продукт команды",
    currencyLabel: "Инвестиции",
    currencyUnit: "кред.",
    reserveLabel: "Спринт-фокус",
    environmentLabel: "Реакция рынка",
    programLabel: "План релиза",
    diagnosisLabel: "Аудит воронки",
    circuitLabel: "Техдолг и нагрузка",
    extraRiskLabel: "Премиум-контракт",
    sectorALabel: "Этап A · Запуск",
    sectorBLabel: "Этап B · Удержание",
    workshopNoun: "прототипе вашего продукта",
  },
};

export const BUILTIN_CARD_TAGS: Record<string, { tag: string; badgeLabel: string; load: number }> = {
  "kevlar-tracks": { tag: "tracked", badgeLabel: "Траки: траверс осыпи", load: 1 },
  "klann-walker": { tag: "tracked", badgeLabel: "Шагающий ход: траверс", load: 1 },
  "stereo-lidar": { tag: "autonomous", badgeLabel: "Лидар: слепой коридор", load: 1 },
  "scissor-lift-arm": { tag: "lift", badgeLabel: "Манипулятор: шлюз", load: 1 },
  "phoenix-wings": { tag: "flight", badgeLabel: "Крылья: перелёт каньона", load: 1 },
  "turtle-shell": { tag: "armor", badgeLabel: "Панцирь: защита в засуху", load: 1 },
  "reinforced-hull": { tag: "stormproof", badgeLabel: "Купол: вход в турбулентность", load: 1 },
  "enterprise-sdk": { tag: "b2b", badgeLabel: "SDK: корпоративный пилот", load: 1 },
};

export function resolveLexicon(template: GameTemplate): TemplateLexicon {
  const fallback = DEFAULT_LEXICONS[template.eventKey] ?? DEFAULT_LEXICONS.rovers;
  return {
    ...fallback,
    objectName: template.lexicon?.objectName ?? template.objectName ?? fallback.objectName,
    currencyLabel: template.lexicon?.currencyLabel ?? template.currencyName ?? fallback.currencyLabel,
    ...(template.lexicon ?? {}),
  };
}

export function resolveDaySchedule(template: GameTemplate): DayScheduleItem[] {
  if (template.daySchedule && template.daySchedule.length > 0) {
    return template.daySchedule;
  }
  return Array.from({ length: template.totalDays }, (_, idx) => {
    const day = idx + 1;
    const engine: RoundEngineType = day === 2 || day === 5 ? "diagnosis" : "mission";
    return { day, engine };
  });
}

export function resolveDayEngine(template: GameTemplate, day: number): RoundEngineType {
  const schedule = resolveDaySchedule(template);
  return schedule.find((item) => item.day === day)?.engine ?? "mission";
}

function defaultMissionForTemplate(template: GameTemplate, day: number): MissionDayConfig {
  const s0 = template.stats[0]?.id ?? "speed";
  const s1 = template.stats[1]?.id ?? s0;
  const s2 = template.stats[2]?.id ?? s1;

  if (template.eventKey === "neurofauna") {
    return {
      day,
      title: `День ${day} · Миграция через высохшее плато`,
      routesA: [
        { id: "short", label: "Прямой каньон", statId: s1, min: 7, bonusPoints: 1, loadCost: 2 },
        { id: "detour", label: "Ночная тропа", statId: s0, min: 4, bonusPoints: 0, loadCost: 1 },
        {
          id: "tag_special",
          label: "Планирующий поток",
          statId: s0,
          min: 5,
          bonusPoints: 1,
          requiredTag: "flight",
          tagCardName: "Крылья феникса",
          loadCost: 2,
        },
      ],
      deliveryB: { label: "Закрепление у воды", statId: s2, min: 4 },
      conditions: [
        { id: "calm", label: "Утренняя роса", delta: 0, weight: 1 },
        { id: "storm", label: "Пик засухи (+2 к B)", delta: 2, weight: 1 },
      ],
      transferPrompt:
        "Какой один компромисс между скоростью и защитой в вашей модели вы проверите расчётом сегодня?",
    };
  }

  if (template.eventKey === "airship") {
    return {
      day,
      title: `День ${day} · Верхний эшелон и зависание над маяком`,
      routesA: [
        { id: "short", label: "Восходящий поток", statId: s1, min: 7, bonusPoints: 1, loadCost: 2 },
        { id: "detour", label: "Спокойный коридор", statId: s0, min: 4, bonusPoints: 0, loadCost: 1 },
        {
          id: "tag_special",
          label: "Проход грозового фронта",
          statId: s1,
          min: 5,
          bonusPoints: 1,
          requiredTag: "stormproof",
          tagCardName: "Армированный купол",
          loadCost: 2,
        },
      ],
      deliveryB: { label: "Точное удержание над маяком", statId: s2, min: 4 },
      conditions: [
        { id: "calm", label: "Ламинарный поток", delta: 0, weight: 1 },
        { id: "storm", label: "Боковой порыв (+2 к B)", delta: 2, weight: 1 },
      ],
      transferPrompt: "Какой один параметр балансировки гондолы вы замерите перед запуском в зале?",
    };
  }

  if (template.eventKey === "startup") {
    return {
      day,
      title: `Раунд ${day} · Выход в корпоративный пилот`,
      routesA: [
        { id: "short", label: "Виральный запуск", statId: s1, min: 7, bonusPoints: 1, loadCost: 2 },
        { id: "detour", label: "Закрытая бета", statId: s0, min: 4, bonusPoints: 0, loadCost: 1 },
        {
          id: "tag_special",
          label: "Прямой B2B-пилот",
          statId: s0,
          min: 5,
          bonusPoints: 1,
          requiredTag: "b2b",
          tagCardName: "Enterprise SDK",
          loadCost: 2,
        },
      ],
      deliveryB: { label: "Удержание и защита SLA", statId: s2, min: 4 },
      conditions: [
        { id: "calm", label: "Лояльный заказчик", delta: 0, weight: 1 },
        { id: "storm", label: "Аудит безопасности (+2 к B)", delta: 2, weight: 1 },
      ],
      transferPrompt: "Какую одну метрику ценности вы проверите на первых 5 пользователях до питча?",
    };
  }

  return {
    day,
    title: `День ${day} · Песчаная гряда и доставка контейнера`,
    routesA: [
      { id: "short", label: "Короткий гребень", statId: s1, min: 7, bonusPoints: 1, loadCost: 2 },
      { id: "detour", label: "Пологий объезд", statId: s0, min: 4, bonusPoints: 0, loadCost: 1 },
      {
        id: "tag_special",
        label: "Траверс по осыпи",
        statId: s1,
        min: 5,
        bonusPoints: 1,
        requiredTag: "tracked",
        tagCardName: "Гусеницы / Шагающий ход",
        loadCost: 2,
      },
    ],
    deliveryB: { label: "Подъём груза на шлюз", statId: s2, min: 4 },
    conditions: [
      { id: "calm", label: "Плотный наст", delta: 0, weight: 1 },
      { id: "storm", label: "Зыбучий нанос (+2 к B)", delta: 2, weight: 1 },
    ],
    transferPrompt:
      "Какой один измеримый параметр (ток мотора, клиренс или угол въезда) вы замерите на физическом ровере сегодня?",
  };
}

function defaultDiagnosisForTemplate(template: GameTemplate, day: number): DiagnosisDayConfig {
  if (template.eventKey === "neurofauna") {
    return {
      day,
      title: `День ${day} · Спад активности популяции у воды`,
      symptom: "Вид уверенно проходит дневной переход, но резко теряет скорость старта на влажном иле.",
      hypotheses: [
        {
          id: "h1",
          label: "Перегрев под тёмным панцирем",
          explanation: "Избыток теплоёмкости без охлаждения.",
        },
        { id: "h2", label: "Дефицит солей в рационе", explanation: "Быстрый обмен веществ истощает резерв." },
        {
          id: "h3",
          label: "Слепая зона бокового зрения",
          explanation: "Позднее обнаружение угрозы с фланга.",
        },
        {
          id: "h4",
          label: "Вязкость тяжёлых клешней на иле",
          explanation: "Масса передних конечностей гасит старт.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Ночное наблюдение без солнечного нагрева",
          resultByHypothesis: {
            h1: "Активность полностью восстановилась",
            h2: "Спад сохраняется у воды",
            h3: "Задержка разворота сохраняется",
            h4: "Вязкий старт на иле сохраняется",
          },
        },
        {
          id: "p2",
          label: "Замер отклика на боковой шорох",
          resultByHypothesis: {
            h1: "Отклик мгновенный",
            h2: "Вялый отклик во всех секторах",
            h3: "Потеря 1.4 сек с фланга",
            h4: "Отклик мгновенный, рывок тяжёлый",
          },
        },
        {
          id: "p3",
          label: "Контрольный старт на твёрдой каменной плите",
          resultByHypothesis: {
            h1: "Утомление через 3 минуты",
            h2: "Низкий тонус с первой секунды",
            h3: "Поздний разворот к цели",
            h4: "Рывок ускорился в 2 раза",
          },
        },
      ],
      secretHypothesisId: "h4",
      maxProbes: 2,
      transferPrompt:
        "Какое одно контрольное наблюдение отделит дефицит энергии от механического сопротивления среды?",
    };
  }

  if (template.eventKey === "airship") {
    return {
      day,
      title: `День ${day} · Рыскание курса у навигационного маяка`,
      symptom: "Аппарат выходит на высоту, но каждые 4 секунды уходит влево от линии курса.",
      hypotheses: [
        { id: "h1", label: "Наводка 50 Гц в нейроканале", explanation: "Шум в тракте управления рулями." },
        {
          id: "h2",
          label: "Смещение аккумулятора в нос",
          explanation: "Нарушена продольная центровка гондолы.",
        },
        {
          id: "h3",
          label: "Просадка оборотов левого винта",
          explanation: "Разбаланс тяги маршевых моторов.",
        },
        {
          id: "h4",
          label: "Тепловой поток от прожектора",
          explanation: "Локальный восходящий вихрь у стены.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Подать эталонный сигнал вместо нейрогарнитуры",
          resultByHypothesis: {
            h1: "Рыскание полностью исчезло",
            h2: "Крен на нос сохранился",
            h3: "Увод влево сохранился",
            h4: "Снос у стены сохранился",
          },
        },
        {
          id: "p2",
          label: "Замер тяги обоих винтов тахометром на стенде",
          resultByHypothesis: {
            h1: "Обороты синхронно плавают",
            h2: "Обороты равны",
            h3: "Левый мотор даёт на 18% меньше оборотов",
            h4: "Обороты равны",
          },
        },
      ],
      secretHypothesisId: "h3",
      maxProbes: 2,
      transferPrompt: "Как за 60 секунд перед вылетом проверить симметрию тяги без лабораторного стенда?",
    };
  }

  if (template.eventKey === "startup") {
    return {
      day,
      title: `Раунд ${day} · Обвал конверсии на втором шаге онбординга`,
      symptom: "80% пользователей открывают создание проекта, но только 9% доходят до первой отправки.",
      hypotheses: [
        {
          id: "h1",
          label: "Слишком длинная анкета из 9 полей",
          explanation: "Высокое трение до первой ценности.",
        },
        {
          id: "h2",
          label: "Таймаут API свыше 12 секунд",
          explanation: "Пользователи закрывают экран ожидания.",
        },
        {
          id: "h3",
          label: "Ранний экран оплаты до демо",
          explanation: "Страх списания без проверки результата.",
        },
        {
          id: "h4",
          label: "Клавиатура iOS перекрывает кнопку",
          explanation: "Кнопка отправки недоступна на мобильных.",
        },
      ],
      probes: [
        {
          id: "p1",
          label: "Срез конверсии отдельно по Desktop и Mobile iOS",
          resultByHypothesis: {
            h1: "Низкая на обеих платформах (9% и 10%)",
            h2: "Низкая на обеих платформах",
            h3: "Низкая на обеих платформах",
            h4: "Desktop 64%, Mobile iOS 2%",
          },
        },
        {
          id: "p2",
          label: "Проверка p95 времени ответа сервера в логах",
          resultByHypothesis: {
            h1: "180 мс — норма",
            h2: "14 200 мс на пике",
            h3: "210 мс — норма",
            h4: "190 мс — норма",
          },
        },
      ],
      secretHypothesisId: "h4",
      maxProbes: 2,
      transferPrompt: "Какой один срез аналитики вы проверите первым, прежде чем переписывать продукт?",
    };
  }

  return {
    day,
    title: `День ${day} · Срыв курса ровера в узком коридоре`,
    symptom:
      "На втором метре трассы ровер резко уводит вправо перед белой стенкой, хотя на старте обе стороны крутились ровно.",
    hypotheses: [
      {
        id: "h1",
        label: "Засветка ИК-датчика бликом",
        explanation: "Верхний свет зала даёт ложный контраст.",
      },
      {
        id: "h2",
        label: "Просадка шины питания под пиком",
        explanation: "Рывок привода перезагружает контроллер.",
      },
      {
        id: "h3",
        label: "Проскальзывание правой ступицы",
        explanation: "Ослаб винт фиксации вала под нагрузкой.",
      },
      {
        id: "h4",
        label: "Перерегулирование ПИД-контура",
        explanation: "Дифференциальный отклик раскачивает курс.",
      },
    ],
    probes: [
      {
        id: "p1",
        label: "Прогон под матовым экраном без верхнего света",
        resultByHypothesis: {
          h1: "Увод полностью исчез",
          h2: "Сбой повторяется на 2-м метре",
          h3: "Увод вправо сохраняется",
          h4: "Раскачка сохраняется",
        },
      },
      {
        id: "p2",
        label: "Вывесить шасси и дать тормозной момент рукой",
        resultByHypothesis: {
          h1: "Оба вала держат жёстко",
          h2: "Контроллер мигает сбросом",
          h3: "Правое колесо проворачивается на валу",
          h4: "Оба вала держат жёстко",
        },
      },
      {
        id: "p3",
        label: "Лог напряжения 5V на плате в момент старта",
        resultByHypothesis: {
          h1: "Стабильные 5.02 В",
          h2: "Провал до 3.6 В перед уводом",
          h3: "Стабильные 4.98 В",
          h4: "Стабильные 5.00 В",
        },
      },
      {
        id: "p4",
        label: "Прямой прогон с отключённым контуром руления",
        resultByHypothesis: {
          h1: "Едет строго прямо",
          h2: "Сбой при включении подъёмника",
          h3: "Плавно тянет вправо под нагрузкой",
          h4: "Едет строго прямо",
        },
      },
    ],
    secretHypothesisId: "h3",
    maxProbes: 2,
    transferPrompt:
      "Какой один 60-секундный тест перед стартом однозначно отделит механический люфт от ошибки в коде?",
  };
}

export function resolveMissionDay(template: GameTemplate, day: number): MissionDayConfig {
  return (
    template.missionDays?.find((m) => m.day === day) ??
    template.missionDays?.[0] ??
    defaultMissionForTemplate(template, day)
  );
}

export function resolveDiagnosisDay(
  template: GameTemplate,
  day: number,
  stripSecret = false,
): DiagnosisDayConfig {
  const base =
    template.diagnosisDays?.find((d) => d.day === day) ??
    template.diagnosisDays?.[0] ??
    defaultDiagnosisForTemplate(template, day);
  if (!stripSecret) return base;
  return {
    ...base,
    secretHypothesisId: "hidden",
    probes: base.probes.map((p) => ({
      ...p,
      resultByHypothesis: {},
    })),
  };
}

export function computeEffectiveMissionStats(team: Team, template: GameTemplate): Record<string, number> {
  const computed = calculateTeamStats(team, template);
  const s0 = template.stats[0]?.id ?? "speed";
  const s1 = template.stats[1]?.id ?? s0;
  const s2 = template.stats[2]?.id ?? s1;
  const baseDefaults: Record<string, number> = {
    [s0]: 4,
    [s1]: 5,
    [s2]: 4,
  };
  const result: Record<string, number> = {};
  for (const stat of template.stats) {
    result[stat.id] = (baseDefaults[stat.id] ?? 3) + (computed.total[stat.id] ?? 0);
  }
  return result;
}

export function computeUnlockedActionTags(
  equippedCards: Record<string, string | null>,
  template: GameTemplate,
): Map<string, string> {
  const tags = new Map<string, string>();
  for (const cid of Object.values(equippedCards)) {
    if (!cid) continue;
    const card = template.cards.find((c) => c.id === cid);
    if (!card) continue;
    const tag = card.actionTag ?? BUILTIN_CARD_TAGS[cid]?.tag;
    if (tag) tags.set(tag, card.name);
  }
  return tags;
}

export function computeEquippedCircuitLoad(
  equippedCards: Record<string, string | null>,
  template: GameTemplate,
): number {
  let load = 2;
  for (const cid of Object.values(equippedCards)) {
    if (!cid) continue;
    const card = template.cards.find((c) => c.id === cid);
    const extra = card?.actionTag ? (card.circuitLoad ?? 1) : (BUILTIN_CARD_TAGS[cid]?.load ?? 0);
    load += extra;
  }
  return load;
}

export function defaultPowerCircuit(template: GameTemplate): PowerCircuitConfig {
  return {
    enabled: template.features.powerCircuit !== false,
    baseCapacity: 5,
    maxOverloadPerStep: 1,
    maxAccumulatedHeat: 2,
    pauseCooling: 1,
  };
}

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
          ? `Итог вырос бы до +${altTotal} очк., но участок ${orders.reserveTarget} остался бы без запаса.`
          : altTotal < totalPoints
            ? `Итог снизился бы до +${altTotal} очк. — выбранное распределение резерва оказалось точным.`
            : `Итог остался бы +${altTotal} очк., сместив риск между участками A и B.`,
    },
  };
}

export function evaluateDualForecast(params: {
  stats: Record<string, number>;
  day: MissionDayConfig;
  orders: MissionTeamOrders;
  circuit: PowerCircuitConfig;
  equippedLoad: number;
}): MissionRunOutcome[] {
  const totalWeight = params.day.conditions.reduce((acc, c) => acc + c.weight, 0);
  return params.day.conditions.map((condition) =>
    evaluateMissionOutcome({
      ...params,
      condition,
      totalWeight,
    }),
  );
}

export function evaluateProbeObservation(
  day: DiagnosisDayConfig,
  usedProbes: string[],
): {
  observations: Record<string, string>;
  eliminatedHypotheses: Record<string, string>;
} {
  const secret = day.secretHypothesisId;
  const observations: Record<string, string> = {};
  const eliminatedHypotheses: Record<string, string> = {};

  for (const probeId of usedProbes) {
    const probe = day.probes.find((p) => p.id === probeId);
    if (!probe) continue;
    const actualReading = probe.resultByHypothesis[secret] ?? "Норма";
    observations[probeId] = actualReading;

    for (const h of day.hypotheses) {
      if (probe.resultByHypothesis[h.id] !== actualReading && !eliminatedHypotheses[h.id]) {
        eliminatedHypotheses[h.id] = `Отсеяно замером «${probe.label}»`;
      }
    }
  }

  return { observations, eliminatedHypotheses };
}

export function evaluateDiagnosisVerdict(params: {
  day: DiagnosisDayConfig;
  hypothesisId: string;
  usedProbesCount: number;
}): {
  correct: boolean;
  points: number;
  currencyDelta: 0;
} {
  const correct = params.hypothesisId === params.day.secretHypothesisId;
  const points = correct ? Math.max(1, 3 - params.usedProbesCount) : 0;
  return {
    correct,
    points,
    currencyDelta: 0,
  };
}

export function validateParetoStrategies(params: {
  day: MissionDayConfig;
  referenceStats: Record<string, number>;
  circuit: PowerCircuitConfig;
  equippedLoad?: number;
}): ParetoCheckResult {
  const { day, referenceStats, circuit, equippedLoad = 3 } = params;
  const shortRoute = day.routesA[0];
  const currentMinA = shortRoute?.min ?? 7;

  const evalForMin = (minA: number) => {
    const modDay: MissionDayConfig = {
      ...day,
      routesA: day.routesA.map((r, i) => (i === 0 ? { ...r, min: minA } : r)),
    };
    const safeOrders: MissionTeamOrders = {
      routeId: modDay.routesA[0]?.id ?? "short",
      paceA: "normal",
      paceB: "normal",
      extraCargo: false,
      reserveTarget: "A",
    };
    const riskOrders: MissionTeamOrders = {
      routeId: modDay.routesA[1]?.id ?? "detour",
      paceA: "normal",
      paceB: "normal",
      extraCargo: true,
      reserveTarget: "B",
    };
    const totalWeight = modDay.conditions.reduce((s, c) => s + c.weight, 0);
    const safeScores = modDay.conditions.map(
      (condition) =>
        evaluateMissionOutcome({
          stats: referenceStats,
          day: modDay,
          orders: safeOrders,
          condition,
          totalWeight,
          circuit,
          equippedLoad,
        }).totalPoints,
    );
    const riskScores = modDay.conditions.map(
      (condition) =>
        evaluateMissionOutcome({
          stats: referenceStats,
          day: modDay,
          orders: riskOrders,
          condition,
          totalWeight,
          circuit,
          equippedLoad,
        }).totalPoints,
    );
    return { safeScores, riskScores };
  };

  const dominates = (a: number[], b: number[]) =>
    a.every((val, idx) => val >= (b[idx] ?? 0)) && a.some((val, idx) => val > (b[idx] ?? 0));

  const { safeScores, riskScores } = evalForMin(currentMinA);
  const safeDominates = dominates(safeScores, riskScores);
  const riskDominates = dominates(riskScores, safeScores);
  const balanced = !safeDominates && !riskDominates;

  let suggestedMinA = currentMinA;
  if (!balanced) {
    const candidates = [3, 4, 5, 6, 7, 8, 9, 10].sort(
      (a, b) => Math.abs(a - currentMinA) - Math.abs(b - currentMinA) || b - a,
    );
    for (const candidate of candidates) {
      const test = evalForMin(candidate);
      if (!dominates(test.safeScores, test.riskScores) && !dominates(test.riskScores, test.safeScores)) {
        suggestedMinA = candidate;
        break;
      }
    }
  }

  return {
    balanced,
    currentMinA,
    suggestedMinA,
    safeScores,
    riskScores,
    conditionLabels: day.conditions.map((c) => c.label),
    summary: balanced
      ? "У каждого плана есть своё преимущество в зависимости от условия среды."
      : riskDominates
        ? `План с дополнительным риском даёт не меньше очков в любую погоду. Рекомендуется снизить порог короткого пути до ${suggestedMinA}.`
        : `Осторожный план доминирует над риском. Рекомендуется повысить порог короткого пути до ${suggestedMinA}.`,
  };
}

export function assignMemberLevers(memberIndex: number, memberCount: number, currentDay: number): number[] {
  if (memberCount <= 1) return [0, 1, 2, 3, 4];
  const shift = (currentDay - 1) % 5;
  if (memberCount >= 5) {
    return [(memberIndex + shift) % 5];
  }
  if (memberCount === 4) {
    const groups = [[0], [1, 2], [3], [4]];
    const rotated = groups[(memberIndex + (currentDay - 1)) % 4] ?? [0];
    return rotated.map((g) => (g + shift) % 5);
  }
  const assigned: number[] = [];
  for (let lever = 0; lever < 5; lever++) {
    const owner = (lever + currentDay - 1) % memberCount;
    if (owner === memberIndex) assigned.push(lever);
  }
  return assigned.length > 0 ? assigned : [0];
}

export function evaluateOpenMilestones(params: {
  outcome: MissionRunOutcome;
  team: Team;
  template: GameTemplate;
}): string[] {
  if (params.template.features.openMilestones === false) return [];
  const earned: string[] = [];
  if (
    !params.outcome.sectorA.trippedCircuit &&
    !params.outcome.sectorB.trippedCircuit &&
    params.outcome.sectorB.heatAfter <= 1 &&
    params.outcome.totalPoints >= 2
  ) {
    earned.push("Чистый проход контура");
  }
  if (params.outcome.sectorA.passed && params.outcome.sectorB.passed) {
    earned.push("Оба участка пройдены");
  }
  if (params.template.slots.every((s) => Boolean(params.team.equippedCards[s.id]))) {
    earned.push("Полная сборка");
  }
  return earned;
}
