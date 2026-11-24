import type { CardItem } from "@stem/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type AdminMode,
  type ClassroomTeam3,
  type CrewMemberSlot,
  type DesignStyle,
  type Engine3Addons,
  evaluateMissionOutcome,
  type MissionTeamOrders,
  type PlayerPhaseId,
  type ProjectorMode,
  type RoundEngineType,
  type SurfaceMode,
  type TemplateLexicon,
  WORLD_PACKS_3,
  type WorldKey,
} from "./engine3-types.js";

function parseInitialParams() {
  if (typeof window === "undefined") {
    return {
      style: "a" as DesignStyle,
      surface: "player" as SurfaceMode,
      world: "rovers" as WorldKey,
      phase: "e3b" as PlayerPhaseId,
      adminMode: "live" as AdminMode,
      projectorMode: "reveal" as ProjectorMode,
    };
  }
  const p = new URLSearchParams(window.location.search);
  const rawStyle = (p.get("design") ?? "a").toLowerCase();
  const style: DesignStyle =
    rawStyle === "2"
      ? "b"
      : rawStyle === "3"
        ? "c"
        : rawStyle === "b" || rawStyle === "c" || rawStyle === "cjm"
          ? rawStyle
          : "a";
  const rawSurface = (p.get("mode") ?? "player").toLowerCase();
  const surface: SurfaceMode =
    rawSurface === "admin" || rawSurface === "split" || rawSurface === "projector" ? rawSurface : "player";
  const rawWorld = (p.get("world") ?? "rovers").toLowerCase();
  const world: WorldKey =
    rawWorld === "neurofauna" || rawWorld === "airship" || rawWorld === "startup" ? rawWorld : "rovers";
  const projectorStart = p.get("proj") === "build" ? "e2" : p.get("proj") === "program" ? "e3a" : "e4";
  const rawPhase = (
    p.get("phase") ?? (surface === "admin" ? "e1" : surface === "projector" ? projectorStart : "e0")
  ).toLowerCase();
  const phase: PlayerPhaseId =
    rawPhase === "e0" ||
    rawPhase === "e1" ||
    rawPhase === "e2" ||
    rawPhase === "e3a" ||
    rawPhase === "e3b" ||
    rawPhase === "e3c" ||
    rawPhase === "e4" ||
    rawPhase === "e5"
      ? rawPhase
      : "e3b";
  const adminMode: AdminMode = p.get("studio") === "constructor" ? "constructor" : "live";
  const rawProj = (
    p.get("proj") ?? (phase === "e4" ? "reveal" : phase === "e2" || phase === "e1" ? "build" : "program")
  ).toLowerCase();
  const projectorMode: ProjectorMode = rawProj === "build" || rawProj === "program" ? rawProj : "reveal";

  return { style, surface, world, phase, adminMode, projectorMode };
}

function buildClassroomTeams(world: WorldKey): ClassroomTeam3[] {
  const pack = WORLD_PACKS_3[world];
  const statIds = pack.template.stats.map((s) => s.id);
  const s0 = statIds[0] ?? "speed";
  const s1 = statIds[1] ?? "traction";
  const s2 = statIds[2] ?? "payload";

  const list: ClassroomTeam3[] = Array.from(
    { length: 10 },
    (_, i) => pack.teamNames[i] ?? { name: `Команда ${i + 1}`, mono: `К${i + 1}`, code: `K-${i + 1}` },
  ).map((entry, idx) => {
    const isHero = idx === 0;
    const altPlan = idx % 2 === 1;
    return {
      id: `team-${idx + 1}`,
      name: entry.name,
      monogram: entry.mono,
      code: entry.code,
      budget: isHero ? 3 : 2 + (idx % 3),
      totalSeasonPoints: 9 - Math.min(6, Math.floor(idx * 0.7)),
      lastRoundPoints: altPlan ? 4 : 3,
      purchasesToday: idx % 3 === 0 ? 0 : 1,
      readyPhones: isHero ? 4 : idx < 7 ? 5 : 3 + (idx % 2),
      totalPhones: 5,
      baseStats: {
        [s0]: 2,
        [s1]: 2,
        [s2]: 2,
      },
      equipped: { ...pack.starterEquipped },
      warehouse: isHero ? [...pack.starterWarehouse] : [],
      orders: altPlan
        ? { routeId: "detour", paceA: "normal", paceB: "normal", extraCargo: true, reserveTarget: "B" }
        : { routeId: "short", paceA: "normal", paceB: "normal", extraCargo: false, reserveTarget: "A" },
    };
  });
  const requested = typeof window === "undefined" ? null : new URLSearchParams(location.search).get("team");
  const hero = list.find((t) => t.code === requested);
  return hero ? [hero, ...list.filter((t) => t !== hero)] : list;
}

export function useEngine3Store() {
  const init = useMemo(parseInitialParams, []);

  const [style, setStyle] = useState<DesignStyle>(init.style);
  const [surface, setSurface] = useState<SurfaceMode>(init.surface);
  const [world, setWorldState] = useState<WorldKey>(init.world);
  const [playerPhase, setPlayerPhase] = useState<PlayerPhaseId>(init.phase);
  const [adminMode, setAdminMode] = useState<AdminMode>(init.adminMode);
  const [constructorStep, setConstructorStep] = useState<1 | 2 | 3 | 4>(1);
  const [projectorMode, setProjectorMode] = useState<ProjectorMode>(init.projectorMode);

  const [lessonDay, setLessonDay] = useState(4);
  const [paretoDay3Fixed, setParetoDay3Fixed] = useState(false);
  const source = WORLD_PACKS_3[world];
  const baseDay = source.missionDay;
  const pack = useMemo(
    () => ({
      ...source,
      missionDay: {
        ...baseDay,
        day: lessonDay,
        routesA: baseDay.routesA.map((r, i) =>
          lessonDay === 3 && i === 0 && !paretoDay3Fixed ? { ...r, min: r.min + 1 } : r,
        ),
      },
    }),
    [source, baseDay, lessonDay, paretoDay3Fixed],
  );
  const [catalog, setCatalog] = useState<Record<string, Partial<CardItem>>>({});
  const template = useMemo(
    () => ({ ...pack.template, cards: pack.template.cards.map((c) => ({ ...c, ...catalog[c.id] })) }),
    [pack.template, catalog],
  );
  const [lessonProbes, setLessonProbes] = useState<string[]>([]);
  const [lessonAnswer, setLessonAnswer] = useState("");
  const [diagnosisScore, setDiagnosisScore] = useState<number | null>(null);
  const pendingTime = useRef(0);
  const [roundResult, setRoundResult] = useState<RoundEngineType>("mission");

  const [customLexicon, setCustomLexicon] = useState<Record<WorldKey, TemplateLexicon>>(() => ({
    rovers: { ...WORLD_PACKS_3.rovers.lexicon },
    neurofauna: { ...WORLD_PACKS_3.neurofauna.lexicon },
    airship: { ...WORLD_PACKS_3.airship.lexicon },
    startup: { ...WORLD_PACKS_3.startup.lexicon },
  }));

  const lexicon = customLexicon[world];

  const [addons, setAddons] = useState<Engine3Addons>({
    powerCircuit: true,
    actionTags: true,
    openMilestones: true,
    offClassPlayground: true,
  });

  const [teams, setTeams] = useState<ClassroomTeam3[]>(() => buildClassroomTeams(init.world));
  const [readySlots, setReadySlots] = useState([true, true, true, false, true]);
  const [myPhoneSlot, setMyPhoneSlot] = useState<0 | 1 | 2 | 3 | 4>(4);
  const [isCaptain, setIsCaptain] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    () => template.slots[1]?.id ?? template.slots[0]?.id ?? "drive",
  );
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [planVotes, setPlanVotes] = useState<Record<string, number>>({});
  const [pingedSlots, setPingedSlots] = useState<Record<number, boolean>>({});
  const [onboardReserveTarget, setOnboardReserveTarget] = useState<"A" | "B">("A");

  const [revealedConditionIdx, setRevealedConditionIdx] = useState<0 | 1>(1);

  const [daySchedule, setDaySchedule] = useState<Array<{ day: number; engine: RoundEngineType }>>([
    { day: 1, engine: "mission" },
    { day: 2, engine: "diagnosis" },
    { day: 3, engine: "mission" },
    { day: 4, engine: "mission" },
    { day: 5, engine: "diagnosis" },
    { day: 6, engine: "mission" },
  ]);

  const [scoreChecks, setScoreChecks] = useState<Record<string, [boolean, boolean]>>({
    "team-1": [true, true],
    "team-2": [true, false],
    "team-3": [true, true],
    "team-4": [false, true],
    "team-5": [true, true],
    "team-6": [true, false],
  });
  const [rewardUndoSnap, setRewardUndoSnap] = useState<Record<string, number> | null>(null);

  const [dryRun, setDryRun] = useState(false);
  const [phaseSeconds, setPhaseSeconds] = useState(86);
  const [toast, setToast] = useState<string | null>(null);

  const engine = daySchedule.find((d) => d.day === lessonDay)?.engine ?? "mission";
  useEffect(() => {
    const duration =
      playerPhase === "e2"
        ? 300
        : playerPhase === "e3a"
          ? 30
          : playerPhase === "e3b"
            ? 90
            : playerPhase === "e3c"
              ? 180
              : 0;
    const seconds = dryRun ? Math.round(duration / 7) : duration;
    pendingTime.current = 0;
    const end = Date.now() + seconds * 1000;
    setPhaseSeconds(seconds);
    if (playerPhase === "e3c") {
      setRoundResult("diagnosis");
      setLessonProbes([]);
      setLessonAnswer("");
      setDiagnosisScore(null);
    }
    if (playerPhase === "e3a" || playerPhase === "e3b") setRoundResult("mission");
    if (playerPhase === "e2") {
      setRoundResult(engine);
      setDiagnosisScore(null);
    }
    if (!duration) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((end + pendingTime.current - Date.now()) / 1000));
      setPhaseSeconds(left);
      if (!left) {
        clearInterval(timer);
        const next =
          playerPhase === "e2"
            ? engine === "mission"
              ? "e3a"
              : engine === "diagnosis"
                ? "e3c"
                : "e4"
            : playerPhase === "e3a"
              ? "e3b"
              : "e4";
        setPlayerPhase(next);
        setProjectorMode(next === "e4" ? "reveal" : "program");
        if (next === "e4") setDryRun(false);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [playerPhase, dryRun, engine]);

  const notify = useCallback((text: string) => {
    setToast(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const switchWorld = useCallback((next: WorldKey) => {
    const nextPack = WORLD_PACKS_3[next];
    setWorldState(next);
    setDryRun(false);
    setCatalog({});
    setLessonProbes([]);
    setLessonAnswer("");
    setDiagnosisScore(null);
    setTeams(buildClassroomTeams(next));
    setReadySlots([true, true, true, false, true]);
    setOnboardReserveTarget("A");
    setRewardUndoSnap(null);
    setPlanVotes({});
    setPingedSlots({});
    setSlotSheetOpen(false);
    setParetoDay3Fixed(false);
    setSelectedSlotId(nextPack.template.slots[1]?.id ?? nextPack.template.slots[0]?.id ?? "body");
  }, []);

  const fallbackTeam = useMemo(() => buildClassroomTeams(world)[0], [world]);
  const myTeam = teams[0] ??
    fallbackTeam ?? {
      id: "team-1",
      name: "Кратер",
      monogram: "КР",
      code: "KR-01",
      budget: 3,
      totalSeasonPoints: 9,
      lastRoundPoints: 3,
      purchasesToday: 0,
      readyPhones: 5,
      totalPhones: 5,
      baseStats: {},
      equipped: {},
      warehouse: [],
      orders: {
        routeId: "short",
        paceA: "normal",
        paceB: "normal",
        extraCargo: false,
        reserveTarget: "A",
      },
    };

  const computeEffectiveStats = useCallback(
    (team: ClassroomTeam3, previewSlot?: string, previewCard?: string) => {
      const sIds = template.stats.map((s) => s.id);
      const s0 = sIds[0] ?? "speed";
      const s1 = sIds[1] ?? "traction";
      const s2 = sIds[2] ?? "payload";
      const totals: Record<string, number> = {
        [s0]: 4,
        [s1]: 5,
        [s2]: 4,
      };

      for (const slot of template.slots) {
        const before = template.cards.find((c) => c.id === pack.starterEquipped[slot.id]);
        const after = template.cards.find((c) => c.id === team.equipped[slot.id]);
        for (const sid of sIds)
          totals[sid] = (totals[sid] ?? 0) + (after?.stats[sid] ?? 0) - (before?.stats[sid] ?? 0);
      }
      if (previewSlot && previewCard) {
        const currentId = team.equipped[previewSlot];
        const curCard = currentId ? template.cards.find((c) => c.id === currentId) : undefined;
        const nextCard = template.cards.find((c) => c.id === previewCard);
        for (const sid of sIds) {
          const curDelta = curCard?.stats[sid] ?? 0;
          const nextDelta = nextCard?.stats[sid] ?? 0;
          totals[sid] = (totals[sid] ?? 4) - curDelta + nextDelta;
        }
      }
      return totals;
    },
    [template, pack.starterEquipped],
  );

  const myStats = useMemo(() => computeEffectiveStats(myTeam), [computeEffectiveStats, myTeam]);

  const unlockedTags = useMemo(() => {
    const tags = new Map<string, string>();
    for (const cid of Object.values(myTeam.equipped)) {
      if (!cid) continue;
      const meta = pack.cardTags[cid];
      const card = template.cards.find((c) => c.id === cid);
      if (meta && card) tags.set(meta.tag, card.name);
    }
    return tags;
  }, [myTeam.equipped, pack.cardTags, template.cards]);

  const equippedLoad = useMemo(() => {
    let load = 2;
    for (const cid of Object.values(myTeam.equipped)) {
      if (!cid) continue;
      load += pack.cardTags[cid]?.load ?? 0;
    }
    return load;
  }, [myTeam.equipped, pack.cardTags]);

  const circuitConfig = useMemo(
    () => ({
      enabled: addons.powerCircuit,
      baseCapacity: 5,
      maxOverloadPerStep: 1,
      maxAccumulatedHeat: 2,
      pauseCooling: 1,
    }),
    [addons.powerCircuit],
  );

  const dualForecast = useMemo(() => {
    const totalWeight = pack.missionDay.conditions.reduce((s, c) => s + c.weight, 0);
    return pack.missionDay.conditions.map((cond) =>
      evaluateMissionOutcome({
        stats: myStats,
        day: pack.missionDay,
        orders: myTeam.orders,
        condition: cond,
        totalWeight,
        circuit: circuitConfig,
        equippedLoad,
      }),
    );
  }, [pack.missionDay, myStats, myTeam.orders, circuitConfig, equippedLoad]);

  const crewSlots: CrewMemberSlot[] = useMemo(
    () => [
      {
        slotIndex: 0,
        memberName: "Аня",
        controlLabel: "1 · Маршрут A",
        debateHint: "Короткий даёт +1 очко, но требует высокий порог с резервом",
        lockedReady: Boolean(readySlots[0]),
        pinged: Boolean(pingedSlots[0]),
      },
      {
        slotIndex: 1,
        memberName: "Макс",
        controlLabel: "2 · Темп A",
        debateHint: "Быстрый темп даёт +1 очко, но поднимает порог A на +2 и греет шину",
        lockedReady: Boolean(readySlots[1]),
        pinged: Boolean(pingedSlots[1]),
      },
      {
        slotIndex: 2,
        memberName: "Илья",
        controlLabel: "3 · Темп B",
        debateHint: "Пауза даст 0 очков на B, но сбросит накопленный перегрев",
        lockedReady: Boolean(readySlots[2]),
        pinged: Boolean(pingedSlots[2]),
      },
      {
        slotIndex: 3,
        memberName: "Даша",
        controlLabel: `4 · ${lexicon.extraRiskLabel}`,
        debateHint: `${lexicon.extraRiskLabel} даёт +2 очка, но требует отдать резерв в B`,
        lockedReady: Boolean(readySlots[3]),
        pinged: Boolean(pingedSlots[3]),
      },
      {
        slotIndex: 4,
        memberName: "Егор",
        controlLabel: `5 · ${lexicon.reserveLabel} (+2)`,
        debateHint: "Спасает ровно один сектор: надёжные 3/2 (в A) или рискованные 4/1 (в B)",
        lockedReady: Boolean(readySlots[4]),
        pinged: Boolean(pingedSlots[4]),
      },
    ],
    [lexicon.extraRiskLabel, lexicon.reserveLabel, pingedSlots, readySlots],
  );

  const updateOrder = useCallback(
    <K extends keyof MissionTeamOrders>(key: K, value: MissionTeamOrders[K]) => {
      if (key !== ["routeId", "paceA", "paceB", "extraCargo", "reserveTarget"][myPhoneSlot]) return;
      setReadySlots((prev) => prev.map((v, i) => i === myPhoneSlot || v));
      setTeams((list) =>
        list.map((t, idx) =>
          idx === 0
            ? {
                ...t,
                readyPhones: readySlots.filter((v, i) => v || i === myPhoneSlot).length,
                orders: { ...t.orders, [key]: value },
              }
            : t,
        ),
      );
    },
    [myPhoneSlot, readySlots],
  );

  const applyStrategyPreset = useCallback(
    (preset: "safe_3_2" | "risk_4_1") => {
      const next: MissionTeamOrders =
        preset === "safe_3_2"
          ? { routeId: "short", paceA: "normal", paceB: "normal", extraCargo: false, reserveTarget: "A" }
          : { routeId: "detour", paceA: "normal", paceB: "normal", extraCargo: true, reserveTarget: "B" };
      setTeams((list) => list.map((t, idx) => (idx === 0 ? { ...t, orders: next } : t)));
      notify(
        preset === "safe_3_2"
          ? "Выбран короткий путь с резервом в A"
          : `Выбран план «${lexicon.extraRiskLabel}» с резервом в B`,
      );
    },
    [lexicon.extraRiskLabel, notify],
  );

  const pingCrewRow = useCallback(
    (slotIdx: number, memberName: string) => {
      setPingedSlots((prev) => ({ ...prev, [slotIdx]: true }));
      notify(`Отправлен сигнал обсуждения на телефон участника (${memberName})`);
      setTimeout(() => {
        setPingedSlots((prev) => ({ ...prev, [slotIdx]: false }));
      }, 2400);
    },
    [notify],
  );

  const installCard = useCallback(
    (card: CardItem, fromWarehouse = false) => {
      if (!isCaptain) {
        setPlanVotes((prev) => ({ ...prev, [card.id]: (prev[card.id] ?? 1) + 1 }));
        notify(`Отметка «В план» добавлена к «${card.name}»`);
        return;
      }
      if (!fromWarehouse && myTeam.purchasesToday >= 1) {
        notify("Лимит сборки: 1 новая деталь в день (перестановка со склада бесплатна)");
        return;
      }
      if (!fromWarehouse && myTeam.budget < card.price) {
        notify(`Не хватает учебного бюджета: нужно ${card.price}, доступно ${myTeam.budget}`);
        return;
      }

      setTeams((list) =>
        list.map((t, idx) => {
          if (idx !== 0) return t;
          const prevEquipped = t.equipped[card.slotId];
          const nextWarehouse = fromWarehouse ? t.warehouse.filter((id) => id !== card.id) : [...t.warehouse];
          if (prevEquipped) nextWarehouse.push(prevEquipped);
          return {
            ...t,
            budget: fromWarehouse ? t.budget : t.budget - card.price,
            purchasesToday: fromWarehouse ? t.purchasesToday : t.purchasesToday + 1,
            equipped: { ...t.equipped, [card.slotId]: card.id },
            warehouse: nextWarehouse,
          };
        }),
      );
      setSlotSheetOpen(false);
      notify(
        fromWarehouse
          ? `Со склада бесплатно установлено «${card.name}»`
          : `Установлено «${card.name}» · списано ${card.price} ${lexicon.currencyUnit}`,
      );
    },
    [isCaptain, myTeam.purchasesToday, myTeam.budget, lexicon.currencyUnit, notify],
  );

  const updateLexiconField = useCallback(
    <K extends keyof TemplateLexicon>(field: K, value: string) => {
      setCustomLexicon((prev) => ({
        ...prev,
        [world]: { ...prev[world], [field]: value },
      }));
    },
    [world],
  );

  const awardMentorCriteria = useCallback(() => {
    const snap: Record<string, number> = {};
    for (const t of teams) snap[t.id] = (scoreChecks[t.id] ?? []).filter(Boolean).length * 2;
    setRewardUndoSnap(snap);

    setTeams((list) =>
      list.map((t) => {
        const checks = scoreChecks[t.id] ?? [false, false];
        const delta = (checks[0] ? 2 : 0) + (checks[1] ? 2 : 0);
        return { ...t, budget: t.budget + delta };
      }),
    );
    notify(`Учебная валюта (${lexicon.currencyLabel}) начислена по критериям наставника`);
  }, [teams, scoreChecks, lexicon.currencyLabel, notify]);

  const undoMentorAward = useCallback(() => {
    if (!rewardUndoSnap) return;
    const snap = rewardUndoSnap;
    setTeams((list) =>
      list.map((t) => {
        const prevVal = snap[t.id];
        return prevVal !== undefined ? { ...t, budget: t.budget - prevVal } : t;
      }),
    );
    setRewardUndoSnap(null);
    notify("Последнее начисление отменено");
  }, [rewardUndoSnap, notify]);

  return {
    style,
    setStyle,
    surface,
    setSurface,
    world,
    switchWorld,
    pack,
    template,
    lexicon,
    updateLexiconField,
    addons,
    setAddons,
    playerPhase,
    setPlayerPhase,
    adminMode,
    setAdminMode,
    constructorStep,
    setConstructorStep,
    projectorMode,
    setProjectorMode,
    teams,
    myTeam,
    myStats,
    computeEffectiveStats,
    myPhoneSlot,
    setMyPhoneSlot,
    isCaptain,
    setIsCaptain,
    selectedSlotId,
    setSelectedSlotId,
    slotSheetOpen,
    setSlotSheetOpen,
    planVotes,
    unlockedTags,
    equippedLoad,
    circuitConfig,
    dualForecast,
    revealedConditionIdx,
    setRevealedConditionIdx,
    crewSlots,
    updateOrder,
    applyStrategyPreset,
    pingCrewRow,
    installCard,
    onboardReserveTarget,
    setOnboardReserveTarget,
    setCatalog,
    lessonProbes,
    setLessonProbes,
    lessonAnswer,
    setLessonAnswer,
    diagnosisScore,
    setDiagnosisScore,
    roundResult,
    extendPhase: () => {
      pendingTime.current += 30000;
    },
    lessonDay,
    setLessonDay,
    baseDay,
    engine,
    daySchedule,
    setDaySchedule,
    paretoDay3Fixed,
    setParetoDay3Fixed,
    scoreChecks,
    setScoreChecks,
    awardMentorCriteria,
    rewardUndoSnap,
    undoMentorAward,
    setDryRun,
    phaseSeconds,
    setPhaseSeconds,
    toast,
    notify,
  };
}

export type Engine3Store = ReturnType<typeof useEngine3Store>;
