import type { StyleRecipe } from "../types";

/**
 * The style library's recipes (U3.4 waves): every base structure beyond the core styles the
 * designer and configurator ship with (`recipes/index.ts`). Kept out of the package's main entry
 * — imported as `@packio/dieline/library` — so a page that only draws the core styles does not
 * carry the library's data (U3.1 follow-up). Listed in the catalogue's reading order.
 */
export const WAVE_RECIPES: readonly StyleRecipe[] = [] as unknown as StyleRecipe[];
