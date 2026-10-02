import type { Scope } from "../expr";
import type { Closure, PanelSpan } from "../construct/tube";
import type {
  Contour,
  Dieline,
  EdgeRole,
  Face,
  FaceKind,
  HingeMap,
  Issue,
  Localized,
  MaterialSpec,
  ParamValues,
} from "../types";

/**
 * The building blocks a style recipe is made of (ADR-0011). A module is a construction a factory
 * would recognise — a four-panel tube, a tuck closure, a window, a lid-and-base set — declared
 * once with what it reads, what it requires, what it contributes, how it folds and which
 * processes a factory needs to make it. Geometry stays code (the `construct/` builders); sizes,
 * rules and the choice of modules are data in the recipe.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/** A module's settings in a recipe (`with`); numbers that depend on the size are expressions. */
export type ModuleConfig = { [key: string]: JsonValue };

export type ModuleSlot = "body" | "closure" | "feature" | "pieceSet";

/** The shape of construction a closure or feature attaches to. */
export type BodyKind = "tube" | "tray" | "flat" | "special";

/**
 * What a factory needs to make a module — the vocabulary of the capability matrix (U3.B3), so a
 * variant is makeable only where a partner has every process its modules list.
 */
export const PROCESSES = [
  "die_cut",
  "slotter",
  "folder_gluer_straight",
  "folder_gluer_crash_lock",
  "folder_gluer_corner",
  "window_patching",
  "hand_assembly",
  "rigid_box_line",
  "pouch_making",
  "label_press",
  "shrink_sleeve",
  "tear_strip_applicator",
  "adhesive_strip_applicator",
] as const;
export type Process = (typeof PROCESSES)[number];

/**
 * A rule over the size, the material and the module's settings, as data. `require` must hold;
 * the constraint is broken only when it is definitely false (see `expr.ts` on unknowns).
 * `code` and `param` are the `Issue` the UI already translates (`tuck.too_deep`…).
 */
export interface Constraint {
  id: string;
  code: string;
  severity: "error" | "warning";
  param?: string;
  require: string;
  message: Localized;
}

/** What building one recipe sees: the values (defaults filled in), the board, and the body's named sizes. */
export interface BuildContext {
  styleId: string;
  v: ParamValues;
  m: MaterialSpec;
  /** The body's named sizes (`front`, `side`, `depth`…), evaluated from its `dims` expressions. */
  dims: Record<string, number>;
  scope: Scope;
  /** Evaluates an expression to a number in this context (`NaN` when it gives none). */
  num(expr: string | number): number;
  /** Evaluates an expression to a boolean in this context (unknown → false). */
  test(expr: string | boolean): boolean;
}

/** A module as a recipe uses it: the definition, its merged settings, and the end it closes. */
export interface ModuleUse {
  def: ModuleDef;
  cfg: ModuleConfig;
  end?: "top" | "bottom";
}

/** Everything a body is built with. */
export interface Parts {
  top?: ModuleUse;
  bottom?: ModuleUse;
  features: ModuleUse[];
}

interface ModuleBase {
  id: string;
  slot: ModuleSlot;
  /** `planned`: declared for the catalogue and U3.4, not buildable yet (`module.not_implemented`). */
  status: "implemented" | "planned";
  label: Localized;
  /** Parameter keys (in the recipe parameter library) this module reads. */
  params: string[];
  /** Rules as data; a function when they depend on the module's settings. */
  constraints?: Constraint[] | ((cfg: ModuleConfig) => Constraint[]);
  /** Rules that need the built geometry (a window inside its panel), coded and run after the data rules. */
  check?(ctx: BuildContext, cfg: ModuleConfig, built: Dieline): Issue[];
  processes: Process[];
  /** The face kinds and line roles it adds to a dieline — for the catalogue and coverage reports. */
  contributes: { kinds: FaceKind[]; roles: EdgeRole[] };
  /** Its part of the fold: roots, angles, stages, placements. */
  hinges?(ctx: BuildContext, cfg: ModuleConfig, end?: "top" | "bottom"): Partial<HingeMap>;
  /** Named settings a recipe can start from (`"preset": "carton"`), merged under its `with`. */
  presets?: Record<string, ModuleConfig>;
}

export interface BodyModule extends ModuleBase {
  slot: "body";
  kind: BodyKind;
  /** False for flat pieces (labels, tags): no hinge map, 2D mockups only (D-152). */
  folds: boolean;
  build(ctx: BuildContext, cfg: ModuleConfig, parts: Parts): Dieline;
}

export interface ClosureModule extends ModuleBase {
  slot: "closure";
  fits: BodyKind[];
  /** The closure on one end of a tube. */
  tube?(ctx: BuildContext, cfg: ModuleConfig, end: "top" | "bottom", parts: Parts): Closure;
  /** Faces hinged on a tray's walls (a lid on the back wall). */
  tray?(ctx: BuildContext, cfg: ModuleConfig, frame: TrayFrame): TrayExtras;
}

export interface FeatureModule extends ModuleBase {
  slot: "feature";
  fits: BodyKind[];
  /** Cut-outs in a tube panel. */
  tubeHoles?(ctx: BuildContext, cfg: ModuleConfig, panel: PanelSpan & { y0: number; y1: number }): Contour[];
  /** Wraps one end's closure (a hang tab standing on the back panel's lid end). */
  wrapClosure?(ctx: BuildContext, cfg: ModuleConfig, end: "top" | "bottom", inner: Closure): Closure;
  /** Faces hinged on a tray's walls (inner walls rolled over). */
  tray?(ctx: BuildContext, cfg: ModuleConfig, frame: TrayFrame): TrayExtras;
  /** Holes in a flat piece. */
  flatHoles?(ctx: BuildContext, cfg: ModuleConfig): Contour[];
}

export interface PieceSetModule extends ModuleBase {
  slot: "pieceSet";
  build(ctx: BuildContext, cfg: ModuleConfig): Dieline;
}

export type ModuleDef = BodyModule | ClosureModule | FeatureModule | PieceSetModule;

/** A tray's sizes in its own frame (see `construct/tray.ts`): base at [h, h + length] × [h, h + width]. */
export interface TrayFrame {
  length: number;
  width: number;
  height: number;
}

export type TrayWall = "wall-back" | "wall-front" | "wall-left" | "wall-right";
export type TrayExtras = Partial<Record<TrayWall, Face[]>>;
