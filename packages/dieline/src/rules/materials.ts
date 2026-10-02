import { GLUE_AREA_INSET_MM, MIN_SLOT_MM, SLOT_CALIPER_FACTOR, WINDOW_MIN_MARGIN_MM } from "../constants";
import type { MaterialSpec } from "../types";

/**
 * Material classes and the manufacturing rules each one brings (U3.2). A recipe's constraints read
 * them as `rule.<name>` (`"tuckDepth >= rule.minTuck"`), so one rule set serves every style made
 * of that class. Values say where they come from: an existing engine constant, the legacy
 * calculators, or a Packio assumption awaiting prepress confirmation (⚠) — the same convention
 * as `constants.ts`. Real calipers always come from the catalogue API.
 */

export const MATERIAL_CLASSES = [
  "paperboard",
  "food_board",
  "corrugated",
  "rigid",
  "flexible",
  "paper",
  "label_stock",
  "shrink_film",
] as const;
export type MaterialClass = (typeof MATERIAL_CLASSES)[number];

export interface MaterialRules {
  /** Calipers this class is made in, mm — outside it the board is not what the class means. ⚠ */
  caliper: [number, number];
  /** Narrowest panel, wall or base a folder-gluer or hand can form, mm (per caliper where given). ⚠ */
  minPanel: number;
  /** Least distance between a cut and a crease running beside it on one face, mm. ⚠ */
  cutToCrease: number;
  /** Narrowest glue flap that takes a glue line, mm (legacy `glueWidthFor` floor: 15; schema min 8). ⚠ */
  minGlueFlap: number;
  /** Least slot between slotted flaps, mm (`slotWidth`: 2 t, at least 3 mm on corrugated). */
  minSlot: number;
  /** Board kept round a window to every cut and crease, mm (`WINDOW_MIN_MARGIN_MM`). */
  windowMargin: number;
  /** Shallowest tuck that holds closed, mm (legacy tuck table starts at 15; schema min 8). ⚠ */
  minTuck: number;
  /** Least reach of a crash-lock hook past the centre line — half the box width, mm. ⚠ */
  crashLockMinDepth: number;
  /** Seal band width a pouch line can make, mm (pouch schema 3–25). ⚠ */
  seal: [number, number];
}

const t = (m: MaterialSpec) => Math.max(0, m.caliperMm);

/** Rules per class; corrugated ones scale with the caliper (and so with the flute). */
const RULES: Record<MaterialClass, (m: MaterialSpec) => MaterialRules> = {
  paperboard: (m) => ({
    caliper: [0.2, 1.2],
    minPanel: 8,
    cutToCrease: Math.max(1, 2 * t(m)),
    minGlueFlap: 8,
    minSlot: 0,
    windowMargin: WINDOW_MIN_MARGIN_MM,
    minTuck: 8,
    crashLockMinDepth: 12,
    seal: [0, 0],
  }),
  food_board: (m) => ({ ...RULES.paperboard(m), caliper: [0.25, 1.0] }),
  corrugated: (m) => ({
    caliper: [0.8, 8],
    minPanel: Math.max(10, 5 * t(m)),
    cutToCrease: Math.max(2, 1.5 * t(m)),
    minGlueFlap: 20,
    minSlot: Math.max(MIN_SLOT_MM, SLOT_CALIPER_FACTOR * t(m)),
    windowMargin: WINDOW_MIN_MARGIN_MM,
    minTuck: 10,
    crashLockMinDepth: 20,
    seal: [0, 0],
  }),
  rigid: (m) => ({
    caliper: [1, 4],
    minPanel: Math.max(10, 5 * t(m)),
    cutToCrease: Math.max(2, t(m)),
    minGlueFlap: 10,
    minSlot: 0,
    windowMargin: Math.max(WINDOW_MIN_MARGIN_MM, 4 * t(m)),
    minTuck: 10,
    crashLockMinDepth: 20,
    seal: [0, 0],
  }),
  flexible: () => ({
    caliper: [0.02, 0.4],
    minPanel: 5,
    cutToCrease: 0,
    minGlueFlap: 0,
    minSlot: 0,
    windowMargin: WINDOW_MIN_MARGIN_MM,
    minTuck: 0,
    crashLockMinDepth: 0,
    seal: [3, 25],
  }),
  paper: (m) => ({ ...RULES.paperboard(m), caliper: [0.05, 0.3], minPanel: 15, minGlueFlap: 12 }),
  label_stock: () => ({
    caliper: [0.04, 0.4],
    minPanel: 3,
    cutToCrease: 0,
    minGlueFlap: GLUE_AREA_INSET_MM,
    minSlot: 0,
    windowMargin: 0,
    minTuck: 0,
    crashLockMinDepth: 0,
    seal: [0, 0],
  }),
  shrink_film: () => ({ ...RULES.label_stock({ caliperMm: 0, kind: "label" }), caliper: [0.02, 0.1] }),
};

const BY_KIND: Record<MaterialSpec["kind"], MaterialClass> = {
  paperboard: "paperboard",
  corrugated: "corrugated",
  rigid: "rigid",
  label: "label_stock",
  flexible: "flexible",
};

/** The class of a material: the catalogue's, or the one its kind implies. */
export function materialClassOf(m: MaterialSpec): MaterialClass {
  return m.class ?? BY_KIND[m.kind];
}

/** The manufacturing rules for a material. */
export function materialRules(m: MaterialSpec): MaterialRules {
  return RULES[materialClassOf(m)](m);
}
