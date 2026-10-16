import { getStyle, REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS, type MaterialSpec } from "@getpack/dieline";

import type { DesignerCatalog, DesignerMaterial, DesignerPattern } from "./data/api";
import type { BoxDims, BoxStyleId, DesignSpec, PatternSettings } from "./types";

/*
 * The designer's view of the catalogue. Materials, patterns, templates, colours and fonts come
 * from the API (`GET /v1/store/designer/catalog`, F4 C.3) — nothing here is a material list.
 * What stays is how to read them: a catalogue material as an engine `MaterialSpec`, which boards
 * a style is made from, and the colour to draw a board in.
 */

/**
 * Board colour by material kind, for a design whose material carries no swatch. Literal on
 * purpose: they describe how real kraft and art card look, so they must not follow the app theme
 * or the brand. Paper is paper.
 */
const KIND_COLOUR: Record<MaterialSpec["kind"], string> = {
  paperboard: "#fbfaf6",
  corrugated: "#c9a57a",
  rigid: "#f4f2ec",
  label: "#ffffff",
  flexible: "#f2f4f6",
};

/** A catalogue material as the engine needs it: caliper, kind, flute and make-up allowances. */
export function materialSpecOf(m: DesignerMaterial): MaterialSpec {
  const allowances = m.allowances
    ? {
        ...(m.allowances.panel !== null ? { panel: m.allowances.panel } : {}),
        ...(m.allowances.flap !== null ? { flap: m.allowances.flap } : {}),
        ...(m.allowances.depth !== null ? { depth: m.allowances.depth } : {}),
      }
    : null;
  return { caliperMm: m.caliperMm, kind: m.kind, flute: m.flute, allowances };
}

/** The spec fields that remember a chosen material, so a design draws without the catalogue. */
export function withMaterial(
  m: DesignerMaterial,
  locale: "th" | "en",
): Pick<DesignSpec, "material" | "materialId" | "materialName" | "boardColour"> {
  return {
    material: materialSpecOf(m),
    materialId: m.id,
    materialName: (locale === "en" ? m.nameEn : null) ?? m.nameTh,
    boardColour: m.swatchHex ?? KIND_COLOUR[m.kind],
  };
}

export type { DesignerMaterial, DesignerPattern };

/**
 * Materials a style can be made from (and, for a catalogue pattern, the ones it lists), thinnest
 * first — the lightest board that makes the style is the sensible default.
 */
export function materialsFor(
  catalog: DesignerCatalog | null,
  style: BoxStyleId,
  patternId?: string | null,
): DesignerMaterial[] {
  if (!catalog) return [];
  const kinds = getStyle(style).materials;
  const pattern = patternId ? catalog.patterns.find((p) => p.id === patternId) : undefined;
  const allowed = pattern && pattern.materialIds.length ? new Set(pattern.materialIds) : null;
  const fits = catalog.materials.filter((m) => kinds.includes(m.kind) && (!allowed || allowed.has(m.id)));
  const list = fits.length ? fits : catalog.materials.filter((m) => kinds.includes(m.kind));
  return [...list].sort((a, b) => a.caliperMm - b.caliperMm);
}

/**
 * A board for a style when the catalogue offers none that fits (or none was loaded): the
 * engine's typical board for its category, so the dieline can still be drawn. It is flagged by
 * `materialId: null` and never reaches a quote.
 */
export function fallbackMaterial(
  style: BoxStyleId,
): Pick<DesignSpec, "material" | "materialId" | "materialName" | "boardColour"> {
  return {
    material: REFERENCE_MATERIALS[REFERENCE_BY_CATEGORY[getStyle(style).category][0]],
    materialId: null,
    materialName: undefined,
    boardColour: undefined,
  };
}

/** The board colour to draw a design on. */
export function boardColour(spec: Pick<DesignSpec, "material" | "boardColour">): string {
  return spec.boardColour ?? KIND_COLOUR[spec.material.kind];
}

/** Clearance added on each side when sizing a box from product dimensions. */
export const PRODUCT_CLEARANCE_MM = 1.5;

/**
 * Inside size for a product: its size plus clearance on each side. The board's thickness is the
 * engine's business — it scores every panel from the inside size (caliper compensation).
 */
export function dimsFromProduct(product: BoxDims): BoxDims {
  const add = PRODUCT_CLEARANCE_MM * 2;
  const r = (n: number) => Math.round((n + add) * 10) / 10;
  return { length: r(product.length), width: r(product.width), height: r(product.height) };
}

export const DEFAULT_PATTERN: PatternSettings = {
  kind: "none",
  color: "#1f6f78",
  background: "#ffffff",
  size: 12,
};

/** Fonts offered when the catalogue lists none (self-hosted families, ADR-0001). */
export const FONT_FAMILIES = ["Noto Sans Thai", "Sarabun", "Prompt", "Kanit", "Arial", "Georgia", "Courier New"];
