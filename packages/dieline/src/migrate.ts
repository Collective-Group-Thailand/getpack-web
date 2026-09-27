import { faceBounds, findFace } from "./faces";
import { pointInPolygon } from "./geom";
import { boundsOf } from "./path";
import { buildDielineV1, type V1Dims, type V1StyleId } from "./compat/v1";
import type { Dieline, MaterialSpec, ParamValues, Pt } from "./types";

/** The version of the dieline part of a design document this engine writes. */
export const SPEC_VERSION = 2;

/** What a design stores about its box: style, parameter values and the board it is built for. */
export interface DielineSpec {
  specVersion: typeof SPEC_VERSION;
  styleId: string;
  values: ParamValues;
  material: MaterialSpec;
  /** Catalogue id of the material (paper grade or flute), when chosen from the catalogue. */
  materialId: string | null;
}

/** A BoxStudio-era spec: `{ style, dims, paperId }`, no version. */
export interface V1Spec {
  style: V1StyleId;
  dims: V1Dims;
  paperId: string;
  productDims?: V1Dims;
}

/**
 * The placeholder boards BoxStudio offered, frozen so their designs keep their caliper. The live
 * catalogue replaces them; a migrated design keeps `materialId` so the editor can offer the
 * nearest real material.
 */
export const LEGACY_BOARDS: Readonly<Record<string, MaterialSpec>> = {
  "ivory-350": { caliperMm: 0.45, kind: "paperboard" },
  "kraft-350": { caliperMm: 0.5, kind: "paperboard" },
  "e-white": { caliperMm: 1.6, kind: "corrugated", flute: "E" },
  "e-kraft": { caliperMm: 1.6, kind: "corrugated", flute: "E" },
  "b-kraft": { caliperMm: 3, kind: "corrugated", flute: "B" },
  "bc-kraft": { caliperMm: 6.5, kind: "corrugated", flute: "BC" },
};

const V1_STYLES = new Set<string>(["rsc", "tuck-end", "tray"]);
const positive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;

export function isV1Spec(x: unknown): x is V1Spec {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  const dims = s.dims as Record<string, unknown> | undefined;
  return (
    !("specVersion" in s) &&
    typeof s.style === "string" &&
    V1_STYLES.has(s.style) &&
    !!dims &&
    positive(dims.length) &&
    positive(dims.width) &&
    positive(dims.height) &&
    typeof s.paperId === "string"
  );
}

export function isDielineSpec(x: unknown): x is DielineSpec {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  const m = s.material as Record<string, unknown> | undefined;
  return (
    s.specVersion === SPEC_VERSION &&
    typeof s.styleId === "string" &&
    !!s.values &&
    typeof s.values === "object" &&
    !!m &&
    typeof m.caliperMm === "number" &&
    typeof m.kind === "string"
  );
}

/**
 * Any stored spec → the current one, or `null` if it cannot be read. v1 keeps its style id (they
 * are the same three ids) and its inside dimensions; the board comes from `LEGACY_BOARDS`.
 */
export function migrateSpec(input: unknown): DielineSpec | null {
  if (isDielineSpec(input)) return input;
  if (!isV1Spec(input)) return null;
  return {
    specVersion: SPEC_VERSION,
    styleId: input.style,
    values: { length: input.dims.length, width: input.dims.width, height: input.dims.height },
    material: LEGACY_BOARDS[input.paperId] ?? { caliperMm: 0.45, kind: "paperboard" },
    materialId: input.paperId,
  };
}

const PANEL_V1: Record<string, string> = { "1": "front", "2": "right", "3": "back", "4": "left" };

/** The v2 face id for a v1 face id of the same style. */
export function v1FaceId(style: V1StyleId, id: string): string {
  const panel = /^panel-(\d)$/.exec(id);
  if (panel) return PANEL_V1[panel[1]];
  if (style === "rsc") {
    const flap = /^(top|bottom)-(\d)$/.exec(id);
    if (flap) return `flap-${PANEL_V1[flap[2]]}-${flap[1]}`;
  }
  if (style === "tuck-end") {
    const dust = /^dust-(top|bottom)-(\d)$/.exec(id);
    if (dust) return `dust-${PANEL_V1[dust[2]]}-${dust[1]}`;
  }
  if (style === "tray") {
    const tab = /^tab-(l|r)-(top|bottom)$/.exec(id);
    if (tab) return `corner-${tab[1] === "l" ? "left" : "right"}-${tab[2]}`;
  }
  return id;
}

/**
 * Where a point of a v1 design belongs on the v2 sheet: it stays on the same face, at the same
 * relative position within that face's bounds. Points off the sheet follow the nearest face.
 */
export function remapV1Point(spec: V1Spec, next: Dieline, p: Pt): Pt {
  const old = buildDielineV1(spec.style, spec.dims);
  let best = old.faces.find((f) => pointInPolygon(p, f.points));
  if (!best) {
    let bestDist = Infinity;
    for (const f of old.faces) {
      const b = boundsOf(f.points);
      const dx = Math.max(b.x - p[0], 0, p[0] - (b.x + b.width));
      const dy = Math.max(b.y - p[1], 0, p[1] - (b.y + b.height));
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = f;
      }
    }
  }
  if (!best) return p;
  const target = findFace(next, v1FaceId(spec.style, best.id));
  if (!target) return p;
  const from = boundsOf(best.points);
  const to = faceBounds(target);
  const sx = from.width > 0 ? to.width / from.width : 1;
  const sy = from.height > 0 ? to.height / from.height : 1;
  return [to.x + (p[0] - from.x) * sx, to.y + (p[1] - from.y) * sy];
}
