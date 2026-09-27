/**
 * Geometry types for flat box dielines. Framework-free: no React, no DOM, no Node-only API.
 *
 * Coordinates are millimetres in the flat sheet's own frame: x to the right, **y downwards**
 * (the frame SVG and every canvas use), origin at the top-left of the sheet. The sheet is seen
 * from its **printed side** — the outside of the finished box.
 */

export type Pt = [number, number];

/**
 * What a line does on the die. The same vocabulary names the export layers:
 * `cut` → CUT, `crease` → CREASE, `perforation` → PERF, `half_cut` → HALFCUT,
 * `glue_area` → GLUE, `bleed` → BLEED (the artwork limit, never on the die itself).
 */
export type EdgeRole = "cut" | "crease" | "perforation" | "half_cut" | "glue_area" | "bleed";

export const EDGE_ROLES: readonly EdgeRole[] = ["cut", "crease", "perforation", "half_cut", "glue_area", "bleed"];

interface EdgeBase {
  from: Pt;
  to: Pt;
  role: EdgeRole;
}

export interface LineEdge extends EdgeBase {
  kind: "line";
}

/**
 * A circular arc from `from` to `to` around `center`. `clockwise` is how the arc looks drawn in
 * the sheet's y-down frame — the direction of increasing angle, SVG's `sweep-flag = 1`.
 */
export interface ArcEdge extends EdgeBase {
  kind: "arc";
  center: Pt;
  radius: number;
  clockwise: boolean;
}

/** A cubic Bézier from `from` to `to` with control points `c1`, `c2`. */
export interface BezierEdge extends EdgeBase {
  kind: "bezier";
  c1: Pt;
  c2: Pt;
}

export type Edge = LineEdge | ArcEdge | BezierEdge;

/** A closed chain of edges: each edge ends where the next begins, the last ends at the first. */
export type Contour = Edge[];

/**
 * What a face is, structurally. It decides the fold stage in the 3D preview (walls first, then
 * flaps, lids, tucks) and lets checks tell a protrusion by design (hanger, handle) from a mistake.
 */
export type FaceKind =
  | "panel"
  | "glue_flap"
  | "dust_flap"
  | "flap"
  | "lock"
  | "lid"
  | "tuck"
  | "base"
  | "wall"
  | "tab"
  | "hanger"
  | "handle"
  | "flat";

export interface Face {
  /** Stable within a style: designs anchor artwork to faces by this id. */
  id: string;
  /** Key into `FACE_LABELS` — never render a face name from anywhere else. */
  label: string;
  kind: FaceKind;
  /** Closed boundary. An edge shared with a neighbouring face is listed by both, with the same ends. */
  outline: Contour;
  /** Cut-outs inside the face: windows, hang holes, handle holes. */
  holes: Contour[];
  /** Lines inside the face that are not its boundary: glue areas, perforations, half-cuts. */
  marks: Edge[];
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Non-geometric information printed beside the dieline. */
export type Annotation = { kind: "grain"; from: Pt; to: Pt };

/** One separately cut blank — a lid and a base are two pieces of one dieline. */
export interface Piece {
  id: string;
  /** Key into `PIECE_LABELS`. */
  label: string;
  faces: Face[];
  /** Where this piece sits in the sheet frame. */
  bounds: Bounds;
  annotations: Annotation[];
}

export interface Dieline {
  styleId: string;
  pieces: Piece[];
  /** Overall layout size; the layout is anchored at the origin. */
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------------------------
// Style definitions
// ---------------------------------------------------------------------------------------------

export interface Localized {
  th: string;
  en: string;
}

/**
 * The board a dieline is built for. Comes from the catalogue API (`paper` / `paper_grade`
 * caliper, or `flute_type` caliper for corrugated board) — never from a table in this package.
 */
export interface MaterialSpec {
  /** Board thickness in millimetres. */
  caliperMm: number;
  kind: "paperboard" | "corrugated" | "rigid" | "label" | "flexible";
  /** Flute code (`E`, `B`, `BC`…) for corrugated board. */
  flute?: string | null;
  /**
   * Make-up allowances from the catalogue, when a flute row carries them (legacy
   * `flute_type.col_a` panel, `col_c` flap, `col_dd` depth). Absent: derived from the caliper.
   */
  allowances?: { panel?: number; flap?: number; depth?: number } | null;
}

export type ParamKind = "length" | "number" | "angle" | "enum" | "boolean";
export type ParamGroup = "size" | "construction" | "closure" | "options" | "window";
export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export interface ParamOption {
  value: string;
  label: Localized;
}

export interface ParamSchema {
  key: string;
  kind: ParamKind;
  group: ParamGroup;
  label: Localized;
  help?: Localized;
  /** Millimetres for `length`, degrees for `angle`. */
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  /** Only relevant (shown, validated) when another parameter has one of these values. */
  when?: { key: string; in: ParamValue[] };
  /** The legacy Locopack size field this corresponds to (`l`, `w`, `h`, `b`, `s`, `cs`, `dl`, `dw`). */
  legacyKey?: string;
}

export interface Issue {
  /** Stable and machine-readable: `size.out_of_range`, `window.outside_panel`… */
  code: string;
  severity: "error" | "warning";
  param?: string;
  message: Localized;
}

/** Where a folded piece sits relative to another in the assembled box (millimetres). */
export interface PiecePlacement {
  /** Sits on top of this piece — a telescope lid over its base. */
  over?: string;
  /** Sits inside this piece — a drawer in its sleeve. */
  inside?: string;
  /** Turned upside down first (a lid's open side faces down). */
  flip?: boolean;
  /** How far it sinks over the piece below when closed (a lid's depth). */
  sink?: number;
  /** How far it hovers above while open, for the animation. */
  lift?: number;
  /** How far it is slid out while open, for the animation. */
  slide?: number;
}

/**
 * How the flat pieces fold into the box. Hinges are found from shared crease lines; this says
 * which face holds each piece still and which folds are not the default 90°.
 */
export interface HingeMap {
  /** Root face per piece id — it stays put while the rest folds around it. */
  roots: Record<string, string>;
  /** Closed fold angle per face id in degrees (default 90; 0 stays flat, e.g. a hanger). */
  angles?: Record<string, number>;
  /** Fold stage per face id, overriding the default from its `kind`. */
  stages?: Record<string, number>;
  /** `base` when the roots are bottoms (trays): the model is turned so the opening faces up. */
  upright?: "front" | "base";
  placement?: Record<string, PiecePlacement>;
}

export type BoxCategory = "folding_carton" | "corrugated" | "tray_lid" | "specialty" | "flat";

export interface StylePreset {
  id: string;
  label: Localized;
  values: ParamValues;
}

export interface BoxStyleDef {
  id: string;
  category: BoxCategory;
  name: Localized;
  description: Localized;
  /** Verified industry codes only — left out rather than guessed. */
  codes?: { fefco?: string; ecma?: string };
  params: ParamSchema[];
  defaults: ParamValues;
  /** Named starting sizes; each is a complete set of values `validate` accepts. */
  presets: StylePreset[];
  /** Materials this style is made from; the catalogue may narrow it further. */
  materials: MaterialSpec["kind"][];
  validate(v: ParamValues, material: MaterialSpec): Issue[];
  /** Builds the dieline, caliper compensation applied. */
  build(v: ParamValues, material: MaterialSpec): Dieline;
  /**
   * How much the folded model may exceed the inside size (mm) beyond the caliper allowance — for
   * styles whose closed shape is not a plain box (pillow, gable, hexagon). Tests use it.
   */
  fold3dSlack?: number;
  /** How the pieces fold; a function when it depends on the size (a lid's depth). */
  faces3d?: HingeMap | ((v: ParamValues, material: MaterialSpec) => HingeMap);
  /** Mapping hints to legacy Locopack `pattern` / `sub_patterns`. */
  legacy?: { patternKeys: string[] };
}
