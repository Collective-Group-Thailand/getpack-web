import tuckEnd from "./data/tuck-end.json" with { type: "json" };
import reverseTuckEnd from "./data/reverse-tuck-end.json" with { type: "json" };
import snapLockBottom from "./data/snap-lock-bottom.json" with { type: "json" };
import crashLockBottom from "./data/crash-lock-bottom.json" with { type: "json" };
import sealEnd from "./data/seal-end.json" with { type: "json" };
import hangTabTuck from "./data/hang-tab-tuck.json" with { type: "json" };
import sleeve from "./data/sleeve.json" with { type: "json" };
import sleeveDrawer from "./data/sleeve-drawer.json" with { type: "json" };
import gable from "./data/gable.json" with { type: "json" };
import hexagonal from "./data/hexagonal.json" with { type: "json" };
import rsc from "./data/rsc.json" with { type: "json" };
import hsc from "./data/hsc.json" with { type: "json" };
import fol from "./data/fol.json" with { type: "json" };
import cssc from "./data/cssc.json" with { type: "json" };
import mailer from "./data/mailer.json" with { type: "json" };
import wrapAround from "./data/wrap-around.json" with { type: "json" };
import tray from "./data/tray.json" with { type: "json" };
import traySixCorner from "./data/tray-6-corner.json" with { type: "json" };
import doubleWallTray from "./data/double-wall-tray.json" with { type: "json" };
import telescope from "./data/telescope.json" with { type: "json" };
import pillow from "./data/pillow.json" with { type: "json" };
import flatRect from "./data/flat-rect.json" with { type: "json" };
import flatRoundedRect from "./data/flat-rounded-rect.json" with { type: "json" };
import flatCircle from "./data/flat-circle.json" with { type: "json" };
import flatOval from "./data/flat-oval.json" with { type: "json" };
import flatCustom from "./data/flat-custom.json" with { type: "json" };
import hangTag from "./data/hang-tag.json" with { type: "json" };
import cupSleeve from "./data/cup-sleeve.json" with { type: "json" };
import band from "./data/band.json" with { type: "json" };
import pouch from "./data/pouch.json" with { type: "json" };
import type { StyleRecipe } from "./types";

/**
 * Every recipe, in the catalogue's reading order (folding carton, corrugated, trays and lids,
 * specialty, flat) — the order of `STYLES` and of the pickers. They are not re-checked when the
 * package loads (the browser would pay for the checker); `recipes.test.ts` runs every one through
 * `parseRecipe`, and recipes from elsewhere (the drawing service, an import) go through it first.
 */
export const RECIPES: readonly StyleRecipe[] = [
  tuckEnd,
  reverseTuckEnd,
  snapLockBottom,
  crashLockBottom,
  sealEnd,
  hangTabTuck,
  sleeve,
  sleeveDrawer,
  gable,
  hexagonal,
  rsc,
  hsc,
  fol,
  cssc,
  mailer,
  wrapAround,
  tray,
  traySixCorner,
  doubleWallTray,
  telescope,
  pillow,
  flatRect,
  flatRoundedRect,
  flatCircle,
  flatOval,
  flatCustom,
  hangTag,
  cupSleeve,
  band,
  pouch,
] as unknown as StyleRecipe[];

export {
  buildFromRecipe,
  outerSizeOf,
  recipeConstraints,
  recipeContext,
  styleFromRecipe,
  type BuiltRecipe,
} from "./build";
export { collectExpressions, parseRecipe } from "./parse";
export { defaultsOf, PARAM_LIBRARY, presetsOf, RECIPE_SETS, RecipeError, resolveParam } from "./params";
export {
  AXIS_PHRASES,
  describeVariant,
  variantKey,
  variantsOf,
  type ReviewStatus,
  type StyleVariant,
  type VariantWords,
} from "./variants";
export type { RecipeModule, RecipeParam, StyleRecipe } from "./types";
