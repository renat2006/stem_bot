import { type Rig, RigSchema } from "../schema.js";

export const RIGS: Record<Rig["id"], Rig> = {
  creature: RigSchema.parse({
    id: "creature",
    viewBox: "0 0 1000 1000",
    ghostPath:
      "M250 510 Q230 380 440 380 L660 390 Q650 230 800 220 Q940 230 930 400 L750 490 L710 840 L650 840 L620 620 L440 620 L380 840 L320 840 L330 580 Q80 550 70 380 Q150 460 250 510Z",
    sockets: [
      { slotId: "body", box: [250, 380, 500, 260], align: "center", z: 2, motion: "bob" },
      { slotId: "head", box: [610, 270, 300, 320], align: "left", z: 4, motion: "bob" },
      { slotId: "front", box: [560, 530, 220, 340], align: "top", z: 3 },
      { slotId: "back", box: [260, 530, 220, 340], align: "top", z: 1 },
      { slotId: "tail", box: [40, 330, 290, 290], align: "right", z: 1, motion: "sway", pivot: [1, 0.5] },
      { slotId: "special", box: [360, 230, 320, 250], align: "bottom", z: 5, motion: "pulse" },
    ],
    shadow: { cx: 500, cy: 905, rx: 330, ry: 38 },
  }),
  airship: RigSchema.parse({
    id: "airship",
    viewBox: "0 0 1000 1000",
    ghostPath:
      "M90 290 Q110 70 500 70 Q880 70 910 290 Q870 520 500 520 Q130 520 90 290Z M330 560 H670 V760 H330Z M470 760 H610 V940 H470Z",
    sockets: [
      { slotId: "envelope", box: [90, 70, 820, 450], align: "center", z: 2, motion: "bob" },
      { slotId: "gondola", box: [330, 560, 340, 200], align: "top", z: 3 },
      { slotId: "propulsion", box: [20, 280, 250, 260], align: "right", z: 4, motion: "pulse" },
      { slotId: "stabilizer", box: [40, 100, 260, 300], align: "right", z: 1 },
      { slotId: "bci", box: [610, 600, 200, 160], align: "center", z: 5 },
      { slotId: "telemetry", box: [470, 760, 140, 200], align: "top", z: 1, motion: "sway" },
    ],
    shadow: { cx: 500, cy: 965, rx: 330, ry: 25 },
  }),
  campus: RigSchema.parse({
    id: "campus",
    viewBox: "0 0 1000 1000",
    ghostPath:
      "M70 650 L500 420 L940 650 L500 900Z M90 520 L260 430 L420 520 V700 L260 790 L90 700Z M600 520 L760 430 L930 520 V700 L760 790 L600 700Z",
    sockets: [
      { slotId: "prod", box: [330, 90, 340, 300], align: "center", z: 5 },
      { slotId: "team", box: [90, 330, 330, 330], align: "center", z: 3 },
      { slotId: "mkt", box: [380, 520, 300, 300], align: "center", z: 4 },
      { slotId: "fin", box: [600, 330, 330, 330], align: "center", z: 3 },
      { slotId: "tech", box: [420, 180, 200, 330], align: "center", z: 1, motion: "pulse" },
    ],
    shadow: { cx: 500, cy: 910, rx: 390, ry: 35 },
  }),
};
