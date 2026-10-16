import "server-only";

import {
  buildFromRecipe,
  defaultsOf,
  dielineToSvg,
  presetsOf,
  REFERENCE_BY_CATEGORY,
  REFERENCE_MATERIALS,
  styleFromRecipe,
} from "@getpack/dieline";
import { ALL_RECIPES } from "@getpack/dieline/library";

/** A style's own dieline as an image: an SVG data URI, the drawing's proportions with it. */
export interface StyleDieline {
  src: string;
  /** Width ÷ height of the drawing. */
  aspect: number;
}

/** Line weight relative to the drawing's longer side, so it reads at the size it is shown. */
const STROKE = { thumb: 1 / 45, card: 1 / 160 } as const;

/**
 * The sizes a dieline is drawn for: the corner thumbnail, a card, and the home's 2×2 feature card,
 * whose lines are 1px at whatever size it is shown (`non-scaling-stroke`) and whose inset is the
 * card's own padding, so the drawing carries only a hairline margin.
 */
export type DielineSize = keyof typeof STROKE | "feature";

type Drawn = { width: number; height: number; svg: (size: DielineSize) => string } | null;

const drawn = new Map<string, Drawn>();

/**
 * The flat dieline of a style base, drawn by `@getpack/dieline` from the base's own recipe — the one
 * getpack-api draws it from (ADR-0010) — on the reference board of its category, at the first of the
 * recipe's starting sizes that passes the engine's own checks. Cut lines and creases keep the
 * engine's layer colours. Null when the engine has no recipe for the base: the card shows no
 * drawing rather than another style's.
 */
function build(code: string): Drawn {
  if (drawn.has(code)) return drawn.get(code)!;
  const recipe = ALL_RECIPES.find((r) => r.base === code && !r.variant) ?? ALL_RECIPES.find((r) => r.base === code);
  let result: Drawn = null;
  if (recipe) {
    try {
      const ids = REFERENCE_BY_CATEGORY[recipe.category];
      const id = ids.find((x) => recipe.materials.includes(REFERENCE_MATERIALS[x].kind)) ?? ids[0]!;
      const material = REFERENCE_MATERIALS[id];
      const style = styleFromRecipe(recipe);
      const sizes = presetsOf(recipe).map((p) => ({ ...defaultsOf(recipe), ...p.values }));
      const values =
        sizes.find((v) => style.validate(v as never, material).every((i) => i.severity !== "error")) ??
        sizes[0] ??
        defaultsOf(recipe);
      const { dieline } = buildFromRecipe(recipe, values, material);
      const longer = Math.max(dieline.width, dieline.height);
      result = {
        width: dieline.width,
        height: dieline.height,
        svg: (size) =>
          size === "feature"
            ? dielineToSvg(dieline, { margin: longer * 0.005, strokeMm: 1 }).replaceAll(
                ' stroke-width="1"',
                ' stroke-width="1" vector-effect="non-scaling-stroke"',
              )
            : dielineToSvg(dieline, { margin: longer * 0.04, strokeMm: longer * STROKE[size] }),
      };
    } catch (error) {
      console.warn(`home: no dieline for ${code}`, error);
    }
  }
  drawn.set(code, result);
  return result;
}

/** The dieline of `code` for a card (`card`), the feature card (`feature`) or a corner thumbnail (`thumb`). */
export function styleDieline(code: string, size: DielineSize): StyleDieline | null {
  const built = build(code);
  if (!built) return null;
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(built.svg(size))}`,
    aspect: built.width / built.height,
  };
}
