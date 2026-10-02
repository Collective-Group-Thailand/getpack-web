import type { Constraint, JsonValue, ModuleConfig } from "../modules/types";
import type { BoxCategory, Localized, MaterialSpec, ParamSchema, ParamValues, StylePreset } from "../types";

/**
 * A style as data (ADR-0011): which modules it is made of, with which settings, plus the
 * parameters, defaults, presets and names a customer sees. Lives in `recipes/data/<id>.json`,
 * is checked by `parseRecipe` and becomes a `BoxStyleDef` through `styleFromRecipe`.
 */
export interface StyleRecipe {
  schemaVersion: 1;
  /** The engine style id, unchanged since F4 — saved designs and the catalogue's `dielineKey` carry it. */
  id: string;
  /**
   * The base structure in `docs/design-tool/style-library-master.json` (`PK-<FAMILY>-<NN>`) this
   * recipe is a variant of, and the master-file axis values it stands for. Informational: the
   * public code and its immutability are the API's (D-184).
   */
  base?: string;
  variant?: Record<string, string>;
  category: BoxCategory;
  name: Localized;
  description: Localized;
  /** Industry codes shown today (verified in F4); new ones wait for Prepress (D-211). */
  codes?: { fefco?: string; ecma?: string };
  materials: MaterialSpec["kind"][];
  /** Parameter keys from `params.json`, or `{ ref, …overrides, omit? }`, or a full inline definition. */
  params: RecipeParam[];
  /** Its defaults, optionally over a shared set: `{ "@extends": "carton", "length": 190 }`. */
  defaults: ParamValues & { "@extends"?: string };
  /** Complete starting sizes, or the name of a shared set in `sets.json`. */
  presets: StylePreset[] | string;
  body?: RecipeModule;
  closures?: { top?: RecipeModule; bottom?: RecipeModule };
  features?: RecipeModule[];
  /** Instead of a body: a set of pieces cut separately (lid + base, sleeve + drawer). */
  pieceSet?: RecipeModule;
  /** Rules of this style alone, run before the modules' own. */
  constraints?: Constraint[];
  /** The closed shape's nominal extent when it is not the inside L × W × H (expressions). */
  closedSize?: { length: string; width: string; height: string };
  /** Module combinations this recipe refuses, with the reason code (checked by `parseRecipe`). */
  incompatible?: { modules: string[]; code: string }[];
  legacy?: { patternKeys: string[] };
}

export type RecipeParam =
  string | ({ ref: string; omit?: (keyof ParamSchema)[] } & Partial<Omit<ParamSchema, "key">>) | ParamSchema;

export interface RecipeModule {
  module: string;
  /** A named settings preset of the module, under `with`. */
  preset?: string;
  with?: ModuleConfig;
}

export type { JsonValue };
