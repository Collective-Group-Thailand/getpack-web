import {
  getStyle,
  RECIPES,
  resolveStyleId,
  SPEC_VERSION,
  type BoxCategory,
  type BoxStyleDef,
  type Issue,
  type ParamValues,
} from "@packio/dieline";

import { dimsFromProduct, fallbackMaterial, materialSpecOf, materialsFor, withMaterial } from "@/features/designer/catalog";
import type { DesignerCatalog } from "@/features/designer/data/api";
import type { BoxDims, DesignSpec } from "@/features/designer/types";

/** How the goods travel (studio-spec §2 ①): it decides which construction families fit first. */
export type ShipsBy = "parcel" | "pallet" | "shelf";

/** Families that fit each journey, best first. Construction facts, not a business rule or a price. */
const FAMILIES: Record<ShipsBy, BoxCategory[]> = {
  parcel: ["corrugated", "folding_carton", "tray_lid", "specialty"],
  pallet: ["corrugated", "tray_lid", "folding_carton", "specialty"],
  shelf: ["folding_carton", "tray_lid", "specialty", "corrugated"],
};

export type SuggestionReason =
  | { code: "fits"; inside: BoxDims }
  | { code: "family"; shipsBy: ShipsBy; category: BoxCategory }
  | { code: "sheet"; sheet: { width: number; height: number } }
  | { code: "advisor" };

export interface Suggestion {
  spec: DesignSpec;
  style: BoxStyleDef;
  reasons: SuggestionReason[];
}

const isBox = (style: BoxStyleDef) =>
  ["length", "width", "height"].every((k) => style.params.some((p) => p.key === k && p.group === "size"));

/**
 * "Describe your product" (U4.2 §2): the product's size (measured by the customer, never guessed)
 * and how it travels → up to three boxes it fits, with why. Each candidate is the product's own
 * pattern when a product is open (else every core box style); its inside size is the product plus
 * the designer's clearance (`dimsFromProduct`); the engine's rules and the product's limits must
 * accept it (`validate` + the pattern's range — the same checks as the setup dialog). They are
 * ordered by how well the family suits the journey, then by the smallest flat sheet (least board), whose size is shown.
 * A corrugated suggestion says the Structure Advisor picks its board in ②. Pure geometry: no price.
 */
export function suggestBoxes(
  product: BoxDims,
  shipsBy: ShipsBy,
  catalog: DesignerCatalog | null,
  locale: "th" | "en",
  extraIssues: (patternId: string | null, values: ParamValues, style: BoxStyleDef) => Issue[] = () => [],
): Suggestion[] {
  const inside = dimsFromProduct(product);
  const candidates: { styleId: string; patternId: string | null }[] = catalog?.patterns.length
    ? catalog.patterns.flatMap((p) => {
        const styleId = resolveStyleId(p.dielineKey ?? p.code);
        return styleId ? [{ styleId, patternId: p.id }] : [];
      })
    : RECIPES.map((r) => ({ styleId: r.id, patternId: null }));

  const families = FAMILIES[shipsBy];
  const fits: (Suggestion & { rank: number; area: number })[] = [];
  const seen = new Set<string>();
  for (const { styleId, patternId } of candidates) {
    if (seen.has(styleId)) continue;
    const style = getStyle(styleId);
    if (!isBox(style)) continue;
    const material = materialsFor(catalog, styleId, patternId)[0];
    const materialPart = material ? withMaterial(material, locale) : fallbackMaterial(styleId);
    const values: ParamValues = { ...style.presets[0]?.values, ...inside };
    const spec = material ? materialSpecOf(material) : materialPart.material;
    const issues = [...style.validate(values, spec), ...extraIssues(patternId, values, style)];
    if (issues.some((issue) => issue.severity === "error")) continue;
    const dieline = style.build(values, spec);
    seen.add(styleId);
    const rank = families.indexOf(style.category);
    fits.push({
      rank: rank < 0 ? families.length : rank,
      area: dieline.width * dieline.height,
      style,
      spec: {
        specVersion: SPEC_VERSION,
        styleId,
        values,
        ...materialPart,
        patternId,
        productDims: product,
      },
      reasons: [
        { code: "fits", inside },
        { code: "family", shipsBy, category: style.category },
        ...(style.category === "corrugated" ? [{ code: "advisor" as const }] : []),
        { code: "sheet", sheet: { width: Math.round(dieline.width), height: Math.round(dieline.height) } },
      ],
    });
  }
  return fits
    .sort((a, b) => a.rank - b.rank || a.area - b.area)
    .slice(0, 3)
    .map(({ spec, style, reasons }) => ({ spec, style, reasons }));
}
