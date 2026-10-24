import type { ParamValues, StyleRecipe } from "@getpack/dieline";

import { keyOf } from "@/features/customer/styles/variants";

/**
 * The recipe of a base whose variant has exactly these options (as `StylePreview3D` finds it), and
 * the parameter values and engine variant key that make it — or `null` when the engine draws none.
 *
 * Its own module, with the engine and the library imported inside: a style page imports it for
 * "ออกแบบใน 3D Studio", and the engine (≈ 35 KB) loads when that button is pressed, not with the page.
 */
export async function recipeOfVariant(
  base: string,
  options: Record<string, unknown>,
): Promise<{ recipe: StyleRecipe; values: ParamValues; key: string } | null> {
  const [{ defaultsOf, presetsOf, variantsOf }, { loadLibrary }] = await Promise.all([
    import("@getpack/dieline"),
    import("./library"),
  ]);
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
