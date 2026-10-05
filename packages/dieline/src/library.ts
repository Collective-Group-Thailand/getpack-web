/**
 * `@packio/dieline/library` — the whole style library (U3.4): the core recipes as the library
 * extends them, and the wave recipes, for the drawing service, the asset pipeline, the tests and
 * the library pages. Importing it registers the modules, parameters and axis words the waves add;
 * a page draws a library style after `registerLibrary()` has added the styles to the registry
 * (`getStyle` then finds them, and finds a core style in its extended form).
 *
 * Nothing here is in the main entry, so the designer and the configurator, which draw the core
 * styles only, carry none of it.
 */
import { registerModules } from "./modules";
import { WAVE_MODULES } from "./modules/library";
import { RECIPES, styleFromRecipe } from "./recipes";
import { WAVE_RECIPES } from "./recipes/library";
import { OVERRIDE_RECIPES } from "./recipes/library/overrides";
import WAVE_PARAMS from "./recipes/library/params.json" with { type: "json" };
import { WAVE_AXIS_PHRASES } from "./recipes/library/phrases";
import { registerParams } from "./recipes/params";
import type { StyleRecipe } from "./recipes/types";
import { registerAxisPhrases } from "./recipes/variants";
import { registerStyles, replaceStyles } from "./styles";
import type { ParamSchema } from "./types";

registerModules(WAVE_MODULES);
registerParams(WAVE_PARAMS as unknown as Record<string, ParamSchema>);
registerAxisPhrases(WAVE_AXIS_PHRASES);

export { OVERRIDE_RECIPES, WAVE_RECIPES };
// Reading a partner's DXF to lay it over a recipe (U3.6, D-272).
export { deviationFrom, INTAKE_TOLERANCE_MM, parseDxf, type Deviation, type DxfDrawing, type DxfPolyline } from "./import/dxf";

const overrides = new Map(OVERRIDE_RECIPES.map((r) => [r.id, r]));

/** Every recipe: the core ones (extended where the library extends them), then the waves'. */
export const ALL_RECIPES: readonly StyleRecipe[] = [...RECIPES.map((r) => overrides.get(r.id) ?? r), ...WAVE_RECIPES];

let registered = false;

/** Adds the library's styles to the registry and puts the extended core styles in place, once. */
export function registerLibrary(): void {
  if (registered) return;
  registered = true;
  replaceStyles(OVERRIDE_RECIPES.map(styleFromRecipe));
  registerStyles(WAVE_RECIPES.map(styleFromRecipe));
}
