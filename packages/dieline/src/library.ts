/**
 * `@packio/dieline/library` — the whole style library (U3.4): the core recipes and the wave
 * recipes, for the drawing service, the asset pipeline, the tests and the library pages. A page
 * that needs a library style draws it after `registerLibrary()` has added the wave styles to the
 * registry (`getStyle` then finds them).
 */
import { RECIPES, styleFromRecipe } from "./recipes";
import { WAVE_RECIPES } from "./recipes/library";
import type { StyleRecipe } from "./recipes/types";
import { registerStyles } from "./styles";

export { WAVE_RECIPES };

/** Every recipe: the core ones (the main entry's `RECIPES`), then the library's. */
export const ALL_RECIPES: readonly StyleRecipe[] = [...RECIPES, ...WAVE_RECIPES];

let registered = false;

/** Adds the library's styles to the registry, once. */
export function registerLibrary(): void {
  if (registered) return;
  registered = true;
  registerStyles(WAVE_RECIPES.map(styleFromRecipe));
}
