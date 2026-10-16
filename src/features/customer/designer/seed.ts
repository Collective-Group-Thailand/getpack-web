import { defaultsOf, presetsOf, resolveStyleId, variantsOf, type StyleRecipe } from "@getpack/dieline";

import type { EditorSeed } from "@/features/designer/components/Editor";

export type Query = Record<string, string | string[] | undefined>;

export const text = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length < 120 ? value : null;
export const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
const mm = (value: unknown) => (typeof value === "string" && /^\d{1,4}(\.\d)?$/.test(value) ? Number(value) : null);

/** A style code as the API writes it (`PK-TE-01`, `PK-TE-01-K7QD`). */
const code = (value: unknown) => (typeof value === "string" && /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(value) ? value : null);

/**
 * The engine values of one variant of a library recipe (D-407): `?rv=` names it by its variant key
 * (`closure=tuck;window=none`) — the recipe's defaults, its first preset, then the variant's own.
 */
function variantValues(recipes: readonly StyleRecipe[], styleId: string, key: unknown) {
  if (typeof key !== "string" || key.length > 300) return null;
  const recipe = recipes.find((candidate) => candidate.id === styleId);
  const variant = recipe ? variantsOf(recipe).find((candidate) => candidate.key === key) : undefined;
  if (!recipe || !variant) return null;
  return { ...defaultsOf(recipe), ...presetsOf(recipe)[0]?.values, ...variant.values };
}

/**
 * A new design's starting point (F4 C.2): `?style=&l=&w=&h=` from the configurator, a style page or
 * an order's artwork page, plus `product`, `pattern` and `material` to preselect the catalogue's
 * choices. A style page's published variant (D-407) adds `base`, `sv` (the variant code) and `rv`
 * (the engine variant), read against `recipes` — the library's, registered before. Anything
 * malformed is ignored — the setup dialog still opens.
 */
export function seedOf(query: Query, recipes: readonly StyleRecipe[] = []): EditorSeed | undefined {
  const style = typeof query.style === "string" ? resolveStyleId(query.style) : null;
  const [length, width, height] = [mm(query.l), mm(query.w), mm(query.h)];
  if (!style || !length || !width || !height) return undefined;
  const [baseCode, styleVariantCode] = [code(query.base), code(query.sv)];
  const values = baseCode && styleVariantCode ? variantValues(recipes, style, query.rv) : null;
  return {
    style,
    dims: { length, width, height },
    ...(values ? { values, variant: { baseCode: baseCode!, styleVariantCode: styleVariantCode! } } : {}),
    productSlug: text(query.product),
    patternId: uuid(query.pattern),
    materialId: uuid(query.material),
  };
}
