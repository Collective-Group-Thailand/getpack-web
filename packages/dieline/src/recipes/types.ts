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
  /**
   * Structural options this recipe varies along (master-file axes, `style-library-program.md` §1):
   * axis → value → the parameter values that make it. Every combination is a variant (`variantsOf`);
   * sizes, materials and prints never are.
   */
  variants?: Record<string, Record<string, ParamValues>>;
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
  /**
   * The closed box's outer extent per axis when it is not the nominal size + 2t (one board layer
   * each side): an open axis (a sleeve's band, a tray's height + t), a flap wrapping a wall (a
   * mailer's front, + 3t). The virtual fold test (U3.3) holds the 3D model to it; the measurement
   * basis conversion (D-182) reads it.
   */
  outerSize?: Partial<Record<"length" | "width" | "height", string>>;
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
