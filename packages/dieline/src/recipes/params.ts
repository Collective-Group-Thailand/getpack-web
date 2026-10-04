import type { ParamSchema, ParamValues, StylePreset } from "../types";
import LIBRARY from "./params.json" with { type: "json" };
import SETS from "./sets.json" with { type: "json" };
import type { RecipeParam, StyleRecipe } from "./types";

/**
 * The shared parameter definitions recipes refer to by key (`params.json`), plus those the style
 * library registers on load (`registerParams`, `recipes/library/params.json`).
 */
export const PARAM_LIBRARY: Record<string, ParamSchema> = { ...(LIBRARY as unknown as Record<string, ParamSchema>) };

export function registerParams(defs: Readonly<Record<string, ParamSchema>>): void {
  for (const [key, def] of Object.entries(defs)) PARAM_LIBRARY[key] ??= def;
}

/** A recipe that cannot be used, with where and why — the drawing service and the import tool show it. */
export class RecipeError extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    detail: string,
  ) {
    super(`${code} at ${path}: ${detail}`);
    this.name = "RecipeError";
  }
}

/** One parameter of a recipe as the style shows it. */
export function resolveParam(p: RecipeParam, path = "params"): ParamSchema {
  if (typeof p === "string") {
    const def = PARAM_LIBRARY[p];
    if (!def) throw new RecipeError("recipe.unknown_param", path, `"${p}" is not in params.json`);
    return { ...def, key: p };
  }
  if ("ref" in p) {
    const { ref, omit, ...over } = p;
    const def = PARAM_LIBRARY[ref];
    if (!def) throw new RecipeError("recipe.unknown_param", path, `"${ref}" is not in params.json`);
    const out = { ...def, ...over, key: ref } as ParamSchema & Record<string, unknown>;
    for (const k of omit ?? []) delete out[k];
    return out;
  }
  return p;
}

/** Preset and default sets several recipes share (`sets.json`): the carton, slotted and label sizes. */
export const RECIPE_SETS = SETS as unknown as {
  presets: Readonly<Record<string, StylePreset[]>>;
  defaults: Readonly<Record<string, ParamValues>>;
};

/** A recipe's presets: its own list, or a named shared set. */
export function presetsOf(r: Pick<StyleRecipe, "presets" | "id">): StylePreset[] {
  if (typeof r.presets !== "string") return r.presets;
  const set = RECIPE_SETS.presets[r.presets];
  if (!set) throw new RecipeError("recipe.unknown_set", `${r.id}.presets`, `"${r.presets}" is not in sets.json`);
  return set;
}

/** A recipe's defaults: its own, over a named shared set when it says `"@extends"`. */
export function defaultsOf(r: Pick<StyleRecipe, "defaults" | "id">): ParamValues {
  const { "@extends": base, ...own } = r.defaults as ParamValues & { "@extends"?: string };
  if (base === undefined) return own;
  const set = RECIPE_SETS.defaults[base];
  if (!set) throw new RecipeError("recipe.unknown_set", `${r.id}.defaults`, `"${base}" is not in sets.json`);
  return { ...set, ...own };
}
