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
/** A pouch's features, one phrase each; a multi-select axis value is the sorted set joined by `+` (packio-api). */
const POUCH_FEATURES: Record<string, Localized> = {
  hang_hole: { th: "รูแขวน", en: "hang hole" },
  tear_notch: { th: "รอยบากฉีก", en: "tear notch" },
  window: { th: "หน้าต่าง", en: "window" },
  zipper: { th: "ซิปล็อก", en: "zipper" },
};

function pouchFeatPhrases(): Record<string, Localized | null> {
  const keys = Object.keys(POUCH_FEATURES).sort();
  const out: Record<string, Localized | null> = { none: null };
  for (let mask = 1; mask < 1 << keys.length; mask++) {
    const set = keys.filter((_k, i) => mask & (1 << i));
    out[set.join("+")] = {
      th: `มี${set.map((k) => POUCH_FEATURES[k].th).join(" ")}`,
      en: set.map((k) => POUCH_FEATURES[k].en).join(", "),
    };
  }
  return out;
}

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
  tuck_top: {
    straight_tuck: { th: "ฝาเสียบ", en: "straight tuck top" },
    reverse_tuck: { th: "ฝาเสียบสลับ", en: "reverse tuck top" },
    airplane_tuck: { th: "ฝาเสียบแบบเครื่องบิน", en: "airplane tuck top" },
    seal: { th: "ฝาปิดกาว", en: "seal top" },
  },
  tuck_bottom: {
    tuck: { th: "ก้นเสียบ", en: "tuck bottom" },
    snap_lock_123: { th: "ก้นล็อก 1-2-3", en: "snap-lock (1-2-3) bottom" },
    crash_lock: { th: "ก้นล็อกอัตโนมัติ", en: "crash-lock bottom" },
    seal: { th: "ก้นปิดกาว", en: "seal bottom" },
    four_flap_lock: { th: "ก้นล็อก 4 ปีก", en: "four-flap lock bottom" },
  },
  lock: {
    friction: { th: "ล็อกด้วยแรงเสียดทาน", en: "friction lock" },
    slit_lock: { th: "ล็อกร่อง", en: "slit lock" },
  },
  tuck_corner: {
    square: { th: "มุมเหลี่ยม", en: "square corners" },
    rounded: { th: "มุมมน", en: "rounded corners" },
  },
  insert: { none: null, die_cut_insert: { th: "มีตัวรองไดคัท", en: "die-cut insert" } },
  corner: {
    glued: { th: "มุมทากาว", en: "glued corners" },
    lock_corner: { th: "มุมล็อก ไม่ใช้กาว", en: "lock corners, no glue" },
  },
  handle: {
    none: null,
    die_cut_handle: { th: "หูหิ้วไดคัท", en: "die-cut handle" },
    insert_handle: { th: "หูหิ้วแบบสอด", en: "insert handle" },
  },
  joint: {
    glue_flap: { th: "ต่อด้วยปีกกาว", en: "glued joint" },
    stitch_flap: { th: "ต่อด้วยลวดเย็บ", en: "stitched joint" },
    tape_joint: { th: "ต่อด้วยเทป", en: "taped joint" },
  },
  vents: {
    none: null,
    round: { th: "รูระบายอากาศกลม", en: "round vents" },
    oblong: { th: "รูระบายอากาศยาว", en: "oblong vents" },
  },
  mailer_front: {
    tuck: { th: "หน้าเสียบ", en: "tuck front" },
    tab_lock: { th: "หน้าล็อกลิ้น", en: "tab-lock front" },
  },
  tear_strip: { none: null, zip_tear_strip: { th: "มีแถบดึงฉีก", en: "zip tear strip" } },
  adhesive: {
    none: null,
    single_strip: { th: "แถบกาวปิดผนึก", en: "adhesive strip" },
    dual_strip_return: { th: "แถบกาวสองเส้น (ส่งคืนได้)", en: "dual adhesive strips (returnable)" },
  },
  shape_flat: {
    rectangle: { th: "สี่เหลี่ยม", en: "rectangle" },
    rounded_rectangle: { th: "สี่เหลี่ยมมุมมน", en: "rounded rectangle" },
    circle: { th: "วงกลม", en: "circle" },
    oval: { th: "วงรี", en: "oval" },
    custom_path: { th: "รูปทรงอิสระ", en: "custom shape" },
  },
  pouch_feat: pouchFeatPhrases(),
  bag_gusset: {
    gusseted: { th: "มีขยายข้าง", en: "gusseted" },
    flat: { th: "แบบแบน", en: "flat" },
  },
  bag_handle: {
    twisted_paper: { th: "หูเชือกกระดาษเกลียว", en: "twisted paper handles" },
    flat_paper: { th: "หูกระดาษแบน", en: "flat paper handles" },
    rope: { th: "หูเชือก", en: "rope handles" },
    die_cut: { th: "หูไดคัท", en: "die-cut handles" },
    none: null,
  },
  partition: Object.fromEntries(
    ["2x2", "2x3", "3x3", "3x4", "4x4", "4x6"].map((g) => {
      const [r, c] = g.split("x");
      return [g, { th: `ช่องกั้น ${r} × ${c}`, en: `${r} × ${c} cells` }];
    }),
  ),
};

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
