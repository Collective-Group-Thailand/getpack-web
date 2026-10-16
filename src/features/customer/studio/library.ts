"use client";

import { defaultsOf, isStyleId, presetsOf, variantsOf, type ParamValues, type StyleRecipe } from "@getpack/dieline";

import { keyOf } from "@/features/customer/styles/variants";

/**
 * The style library in the studio (U4.2): a published variant can be a wave recipe that only
 * `@getpack/dieline/library` draws (U3.4). It is loaded on demand — the studio's first load keeps the
 * core styles only — and registered once, so `getStyle` and saved designs find its styles.
 */
export async function loadLibrary() {
  const library = await import("@getpack/dieline/library");
  library.registerLibrary();
  return library;
}

/** A saved style id the main entry does not know needs the library before the design can open. */
export const needsLibrary = (styleId: unknown) => typeof styleId === "string" && !isStyleId(styleId);

/**
 * The recipe of a base whose variant has exactly these options (as `StylePreview3D` finds it), and
 * the parameter values and engine variant key that make it — or `null` when the engine draws none.
 */
export async function recipeOfVariant(
  base: string,
  options: Record<string, unknown>,
): Promise<{ recipe: StyleRecipe; values: ParamValues; key: string } | null> {
  const { ALL_RECIPES } = await loadLibrary();
  const wanted = Object.entries(options).map(([axis, value]) => [axis, keyOf(value)] as const);
  for (const recipe of ALL_RECIPES.filter((r) => r.base === base)) {
    const variant = variantsOf(recipe).find(
      (v) =>
        wanted.every(([axis, value]) => v.axes[axis] === value) &&
        Object.keys(v.axes).every((a) => options[a] !== undefined || a in (recipe.variant ?? {})),
    );
    if (variant)
      return {
        recipe,
        values: { ...defaultsOf(recipe), ...presetsOf(recipe)[0]?.values, ...variant.values },
        key: variant.key,
      };
  }
  return null;
}
