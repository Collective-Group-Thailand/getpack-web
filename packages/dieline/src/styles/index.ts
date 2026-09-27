import { withDefaults } from "../params";
import type { BoxStyleDef, Dieline, HingeMap, Issue, MaterialSpec, ParamValues } from "../types";
import { rsc } from "./rsc";
import { tray } from "./tray";
import { reverseTuckEnd, tuckEnd } from "./tuck-end";

/**
 * Every style the engine can draw. Order is the catalogue's natural reading order: folding
 * carton, corrugated, trays and lids, specialty, flat.
 */
export const STYLES: readonly BoxStyleDef[] = [tuckEnd, reverseTuckEnd, rsc, tray];

const BY_ID = new Map(STYLES.map((s) => [s.id, s]));

/**
 * Keys the catalogue may carry in `pattern.dielineKey` that are not style ids: short codes
 * (`rte`, `ste`) and legacy drawing-service names. The configurator, the designer and the
 * drawing service resolve through this one table.
 */
export const STYLE_ALIASES: Readonly<Record<string, string>> = {
  ste: "tuck-end",
  "straight-tuck-end": "tuck-end",
  "folding-truck-end-box": "tuck-end",
  rte: "reverse-tuck-end",
  "corrugate-rsc": "rsc",
};

export function resolveStyleId(key: string | null | undefined): string | null {
  if (!key) return null;
  const k = key.trim().toLowerCase();
  if (BY_ID.has(k)) return k;
  const alias = STYLE_ALIASES[k];
  return alias && BY_ID.has(alias) ? alias : null;
}

export const isStyleId = (key: string | null | undefined): boolean => resolveStyleId(key) !== null;

export function getStyle(key: string): BoxStyleDef {
  const id = resolveStyleId(key);
  const style = id ? BY_ID.get(id) : undefined;
  if (!style) throw new Error(`Unknown box style "${key}"`);
  return style;
}

/** Values with the style's defaults filled in — what `build` actually used. */
export function resolveValues(style: BoxStyleDef, v: ParamValues): ParamValues {
  return withDefaults(style.defaults, v);
}

export function buildStyle(key: string, v: ParamValues, material: MaterialSpec): Dieline {
  return getStyle(key).build(v, material);
}

export function validateStyle(key: string, v: ParamValues, material: MaterialSpec): Issue[] {
  return getStyle(key).validate(v, material);
}

/** The hinge map for a style at a size (some depend on it, e.g. a lid's depth). */
export function hingeMapOf(style: BoxStyleDef, v: ParamValues, material: MaterialSpec): HingeMap | null {
  const f = style.faces3d;
  if (!f) return null;
  return typeof f === "function" ? f(resolveValues(style, v), material) : f;
}

export { rsc, tray, tuckEnd, reverseTuckEnd };
