/**
 * Rules of thumb every style builds on, in one place for prepress engineers to review.
 *
 * Each value says where it comes from: the legacy Locopack calculators (`calculate_conditions`,
 * `PatternArea.php`, `CalculatorCorrugate.php` — see docs/design-tool/style-mapping.md), common
 * carton practice, or a getpack assumption still awaiting prepress confirmation (marked ⚠).
 * Everything is millimetres unless named otherwise.
 */
import type { MaterialSpec } from "./types";

// --- Caliper compensation --------------------------------------------------------------------
//
// Customers give INSIDE dimensions. A crease sits at about mid-thickness, so two parallel walls
// joined by a panel of score-to-score width s have an inside distance of s − t (t = caliper).
// Hence every panel is scored at inside + 1·t. The depth between the top and bottom creases
// carries a closure layer at each end, so it is scored at inside + 2·t (one end for trays).
// Catalogue flute rows may carry their own make-up allowances (legacy `flute_type.col_a`,
// `col_c`, `col_dd`); when present those win over the caliper rule.

/** Panel score = inside + PANEL_CALIPER_FACTOR × t. */
export const PANEL_CALIPER_FACTOR = 1;
/** Depth score (closed both ends) = inside + DEPTH_CALIPER_FACTOR × t. Legacy folding uses d + 1 on ~0.45 mm board. */
export const DEPTH_CALIPER_FACTOR = 2;
/** Depth score of an open tray = inside + TRAY_DEPTH_CALIPER_FACTOR × t. */
export const TRAY_DEPTH_CALIPER_FACTOR = 1;
/** A flap that must meet its opposite number at the centre gets this × t extra (legacy `Flap = W/2 + col_c`). */
export const FLAP_CALIPER_FACTOR = 0.5;
/**
 * The panel the glue flap is glued inside is scored this × t narrower, so the seam does not
 * bulge (legacy folding: first W panel `w − 1`; corrugated RSC: last panel `W + a − 3`).
 */
export const GLUE_PANEL_REDUCTION_FACTOR = 1;

export interface Allowances {
  panel: number;
  depth: number;
  trayDepth: number;
  flap: number;
  gluePanel: number;
}

/** The make-up allowances for a material: catalogue values when given, the caliper rules otherwise. */
export function allowancesOf(m: MaterialSpec): Allowances {
  const t = Math.max(0, m.caliperMm);
  return {
    panel: m.allowances?.panel ?? PANEL_CALIPER_FACTOR * t,
    depth: m.allowances?.depth ?? DEPTH_CALIPER_FACTOR * t,
    trayDepth: TRAY_DEPTH_CALIPER_FACTOR * t,
    flap: m.allowances?.flap ?? FLAP_CALIPER_FACTOR * t,
    gluePanel: GLUE_PANEL_REDUCTION_FACTOR * t,
  };
}

// --- Folding carton ----------------------------------------------------------------------------

/** Tuck flap depth by box length — legacy `calculate_conditions` #1 (`f` by `l`). */
export function tuckDepthFor(lengthMm: number): number {
  if (lengthMm <= 150) return 15;
  if (lengthMm <= 300) return 20;
  return 25;
}

/** Glue flap width by box width — legacy `calculate_conditions` #2 (`g` by `w`); corrugated uses a flat 35. */
export function glueWidthFor(widthMm: number, m: MaterialSpec): number {
  if (m.kind === "corrugated") return CORRUGATED_GLUE_FLAP_MM;
  return widthMm <= 150 ? 15 : 25;
}

/** The glue flap's ends are cut back at this angle so it clears the flaps above and below. */
export const GLUE_FLAP_TAPER_DEG = 15;
/** Glue is applied this far inside the glue flap's edges (the GLUE layer outline). ⚠ */
export const GLUE_AREA_INSET_MM = 2;
/** Dust flap reach, as a share of box length and of box width — whichever is smaller (BoxStudio rule). */
export const DUST_FLAP_LENGTH_SHARE = 0.45;
export const DUST_FLAP_WIDTH_SHARE = 0.9;
/** Dust flaps are cut back from the lid-side crease by caliper + this, so the lid closes flat. */
export const DUST_FLAP_CLEARANCE_MM = 1;
/** Default radius of rounded tuck corners, capped at half the tuck depth. */
export const TUCK_CORNER_RADIUS_MM = 6;
/** The tuck's shoulders are cut back this far so it slides past the dust flaps. */
export const TUCK_SHOULDER_MM = 1.5;
/** Thumb notch radius when enabled; at most a quarter of the panel width. */
export const THUMB_NOTCH_RADIUS_MM = 10;
/** Snap-lock (1-2-3) bottom flap tongue: `b` by width — legacy PatternArea pid 16 (3 / 5 / 10). */
export function snapLockTongueFor(widthMm: number): number {
  if (widthMm <= 30) return 3;
  if (widthMm <= 80) return 5;
  return 10;
}

// --- Windows and holes -------------------------------------------------------------------------

/** A window keeps at least this much board to every cut and crease of its panel. ⚠ */
export const WINDOW_MIN_MARGIN_MM = 6;
/** Euro-slot hang hole: the common retail peg shape, width × height. */
export const EURO_SLOT_WIDTH_MM = 32;
export const EURO_SLOT_HEIGHT_MM = 10;
/** Round hang hole diameter; legacy tags offer 3 or 6 mm (`dim`). */
export const HANG_HOLE_DIAMETER_MM = 6;

// --- Corrugated ------------------------------------------------------------------------------

/** Corrugated manufacturer's joint (glue flap). ⚠ legacy reads `flute_type.col_g`; 35 until the catalogue carries it. */
export const CORRUGATED_GLUE_FLAP_MM = 35;
/** Slot width between corrugated flaps = this × caliper, at least `MIN_SLOT_MM`. */
export const SLOT_CALIPER_FACTOR = 2;
export const MIN_SLOT_MM = 3;

// --- Trays -----------------------------------------------------------------------------------

/** Corner glue flaps of a tray reach this share of the wall height, cut back at 45°. */
export const TRAY_CORNER_FLAP_SHARE = 0.85;
/** …and never more than this. */
export const TRAY_CORNER_FLAP_MAX_MM = 25;

// --- Two-piece boxes -------------------------------------------------------------------------

/** Clearance between a telescope lid and its base on each side (lid inside = base outside + 2 × this). ⚠ */
export const LID_CLEARANCE_MM = 1;
/** Clearance between a drawer and its sleeve on each side. ⚠ */
export const DRAWER_CLEARANCE_MM = 1;

// --- Artwork -----------------------------------------------------------------------------------

/** Print bleed beyond every cut (D-070 blocks a file without it). The live value is the settings API's. */
export const DEFAULT_BLEED_MM = 3;
/** Safe zone inside every cut and crease. The live value is the settings API's. */
export const DEFAULT_SAFE_MM = 3;
