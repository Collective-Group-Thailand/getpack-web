import "server-only";

import {
  buildFromRecipe,
  defaultsOf,
  dielineToSvg,
  presetsOf,
  REFERENCE_BY_CATEGORY,
  REFERENCE_MATERIALS,
  styleFromRecipe,
  variantsOf,
} from "@getpack/dieline";
import { ALL_RECIPES } from "@getpack/dieline/library";

import { keyOf } from "./variants";

/** How many drawings stay in memory; past it the oldest are drawn again on demand. */
const CACHE = 1500;
const drawn = new Map<string, string | null>();

/**
 * A variant's flat dieline as an SVG (D-410), drawn by `@getpack/dieline` from the recipe that has
 * exactly its options — the one getpack-api draws it from — on its category's reference board, at the
 * recipe's first starting size the engine accepts. It stands in for the API's rendered thumbnail on
 * the library's cards until that is rendered. `null` when the engine draws no such variant.
 */
export function variantPreviewSvg(base: string, options: Record<string, unknown>): string | null {
  const wanted = Object.entries(options)
    .map(([axis, value]) => [axis, keyOf(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const cacheKey = `${base}|${wanted.map(([a, v]) => `${a}=${v}`).join(";")}`;
  if (drawn.has(cacheKey)) return drawn.get(cacheKey)!;
  let svg: string | null = null;
  const recipes = ALL_RECIPES.filter((r) => r.base === base);
  // No options: the style itself — its plain recipe's first variant, as the home's cards draw it.
  if (wanted.length === 0) recipes.sort((a, b) => Number(Boolean(a.variant)) - Number(Boolean(b.variant)));
  for (const recipe of recipes) {
    const variant = variantsOf(recipe).find(
      (v) =>
        wanted.length === 0 ||
        (wanted.every(([axis, value]) => v.axes[axis] === value) &&
          Object.keys(v.axes).every((a) => options[a] !== undefined || a in (recipe.variant ?? {}))),
    );
    if (!variant) continue;
    try {
      const ids = REFERENCE_BY_CATEGORY[recipe.category];
      const id = ids.find((x) => recipe.materials.includes(REFERENCE_MATERIALS[x].kind)) ?? ids[0]!;
      const material = REFERENCE_MATERIALS[id];
      const style = styleFromRecipe(recipe);
      const sizes = [
        ...presetsOf(recipe).map((p) => ({ ...defaultsOf(recipe), ...p.values, ...variant.values })),
        { ...defaultsOf(recipe), ...variant.values },
      ];
      const values =
        sizes.find((v) => style.validate(v as never, material).every((i) => i.severity !== "error")) ?? sizes[0]!;
      const { dieline } = buildFromRecipe(recipe, values, material);
      const longer = Math.max(dieline.width, dieline.height);
      svg = dielineToSvg(dieline, { margin: longer * 0.04, strokeMm: longer / 160 });
    } catch (error) {
      console.warn(`styles: no preview for ${cacheKey}`, error);
    }
    break;
  }
  if (drawn.size >= CACHE) drawn.delete(drawn.keys().next().value!);
  drawn.set(cacheKey, svg);
  return svg;
}
