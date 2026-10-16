import { getModule } from "../modules";
import type { Localized, ParamValues } from "../types";
import REVIEWED from "./names.reviewed.json" with { type: "json" };
import type { StyleRecipe } from "./types";

/**
 * Structural variants of a recipe and the words for them (U3.3 §4). A variant is one combination of
 * the recipe's `variants` axes on top of its fixed `variant` axes; its key is every axis sorted
 * (`hang=none;tuck_bottom=tuck;tuck_top=straight_tuck;window=front_window`), the normalised option
 * key the catalogue stores (U3.B1).
 */
export interface StyleVariant {
  key: string;
  /** Every axis value, fixed and chosen. */
  axes: Record<string, string>;
  /** The parameter values the chosen axes set. */
  values: ParamValues;
}

export const variantKey = (axes: Record<string, string>) =>
  Object.keys(axes)
    .sort()
    .map((k) => `${k}=${axes[k]}`)
    .join(";");

/** Every variant, in the order the recipe lists its axes and values. */
export function variantsOf(recipe: StyleRecipe): StyleVariant[] {
  let combos: { axes: Record<string, string>; values: ParamValues }[] = [{ axes: { ...recipe.variant }, values: {} }];
  for (const [axis, options] of Object.entries(recipe.variants ?? {}))
    combos = combos.flatMap((c) =>
      Object.entries(options).map(([value, set]) => ({
        axes: { ...c.axes, [axis]: value },
        values: { ...c.values, ...set },
      })),
    );
  return combos.map((c) => ({ key: variantKey(c.axes), ...c }));
}

/**
 * What an axis value adds to a name — module and feature wording only, never a claim. `null` adds
 * nothing (the plain option). Thai wording follows the shop-floor terms in `labels.ts`.
 */
export const AXIS_PHRASES: Record<string, Record<string, Localized | null>> = {
  window: {
    none: null,
    front_window: { th: "มีหน้าต่างด้านหน้า", en: "front window" },
    top_window: { th: "มีหน้าต่างด้านบน", en: "top window" },
  },
  hang: {
    none: null,
    euro_slot: { th: "รูแขวนแบบยูโร", en: "euro slot hang hole" },
    round_hole: { th: "รูแขวนกลม", en: "round hang hole" },
    sombrero_header: { th: "หัวแขวนทรงหมวก", en: "sombrero hang header" },
  },
  thumb: { none: null, thumb_notch: { th: "มีรูดึง", en: "finger pull" } },
  hand_holes: {
    none: null,
    end_panels: { th: "ช่องมือจับด้านข้าง", en: "hand holes in the end panels" },
    side_panels: { th: "ช่องมือจับด้านยาว", en: "hand holes in the side panels" },
  },
  lid_depth: {
    full: { th: "ฝาครอบเต็ม", en: "full-depth lid" },
    partial: { th: "ฝาครอบบางส่วน", en: "partial-depth lid" },
  },
};

/** Phrases for the axes the style library adds (`@getpack/dieline/library`), registered on load. */
export function registerAxisPhrases(phrases: Readonly<Record<string, Record<string, Localized | null>>>): void {
  for (const [axis, values] of Object.entries(phrases)) AXIS_PHRASES[axis] = { ...values, ...AXIS_PHRASES[axis] };
}

export type ReviewStatus = "pending" | "approved";

export interface VariantWords {
  name: Localized;
  description: Localized;
  /** `approved` once Marketing (wording) and Prepress (terms) signed the words off (D-212). */
  reviewStatus: ReviewStatus;
}

const reviewed = REVIEWED as unknown as Record<string, { name: Localized; description: Localized }>;

/**
 * The variant's Thai and English name and short description, made from the recipe's name, the
 * chosen axis phrases and its modules' labels; an approved wording in `names.reviewed.json`
 * (keyed `<style>|<variant key>`) replaces it.
 */
export function describeVariant(recipe: StyleRecipe, variant: StyleVariant): VariantWords {
  const approved = reviewed[`${recipe.id}|${variant.key}`];
  if (approved) return { ...approved, reviewStatus: "approved" };
  const chosen = Object.keys(recipe.variants ?? {})
    .map((axis) => AXIS_PHRASES[axis]?.[variant.axes[axis]])
    .filter((p): p is Localized => !!p);
  const name = {
    th: [recipe.name.th, ...chosen.map((p) => p.th)].join(" · "),
    en: [recipe.name.en, ...chosen.map((p) => p.en)].join(" · "),
  };
  const uses = [
    recipe.body ?? recipe.pieceSet,
    recipe.closures?.top,
    recipe.closures?.bottom,
    ...(recipe.features ?? []),
  ];
  const labels = [...new Set(uses.filter(Boolean).map((u) => getModule(u!.module)!.label))];
  const description = {
    th: `โครงสร้าง: ${labels.map((l) => l.th).join(" · ")}`,
    en: `Construction: ${labels.map((l) => l.en).join(" · ")}`,
  };
  return { name, description, reviewStatus: "pending" };
}
