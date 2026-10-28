import { oklchToHex, PALETTES, PRINT } from "@/ui/tokens";

/**
 * Colours for the canvas, resolved to hex from the design tokens.
 *
 * Konva, the SVG export and the print PDF all need literal colour values — a CSS variable
 * cannot reach a `<canvas>` or a generated PDF. So rather than leaving hex literals scattered
 * through the renderer, they are derived here from the same tokens the UI uses, once.
 *
 * Two groups, with different rules:
 *
 * - **Print marks** (`CUT`, `FOLD`, `SAFE_ZONE`) are deliberately *not* themed. A cut line
 *   means the same thing in dark mode, and the same value goes into the dieline SVG the
 *   factory cuts from. They come from `PRINT` in the token primitives.
 * - **Canvas chrome** (labels, selection handles, paper shadow) is UI. It is resolved from the
 *   light theme's palette because the artwork underneath is always on white or kraft board —
 *   the work area does not invert with the app theme, or a proof would lie about the print.
 *
 * Not here: the dieline **SVG export** in `@getpack/dieline` writes pure red (#ff0000) for cut
 * and pure blue (#0066ff) for crease. Those are the die-maker's convention for a cut file, not
 * our colours, and they must not follow the brand.
 */
export const CANVAS_COLORS = {
  /** Dieline cut line — red, and the same red the SVG export writes. */
  cut: oklchToHex(PRINT.cut),
  /** Fold/crease line — blue, dashed. */
  fold: oklchToHex(PRINT.fold),
  /** 3 mm safe-zone outline — green, dashed. */
  safeZone: oklchToHex(PRINT.safe),
  /** Panel names ("ฝาบน", "ปีกกาว") drawn over the sheet. */
  panelLabel: oklchToHex(PALETTES.neutral[500]),
  /** Selection box and resize handles. */
  selection: oklchToHex(PALETTES.brand[700]),
  /** The board's drop shadow, to lift the sheet off the work surface. */
  paperShadow: "#000000",
  /** Ruler guides (C8 pro): a cool cyan apart from the cut, fold and safe marks. */
  guide: oklchToHex({ l: 0.66, c: 0.12, h: 220 }),
  /** Preflight markers (C8): must fix / advice — the status hues of the UI. */
  issueBlock: oklchToHex(PALETTES.red[600]),
  issueWarn: oklchToHex(PALETTES.orange[500]),
} as const;

/**
 * Starting colours for newly added artwork. These are the *customer's* design content, not
 * UI chrome: once placed, the customer changes them freely and they end up on printed board.
 *
 * Literal values, not palette steps, for the same reason as the print marks: they are ink on
 * board, so a UI rebrand (D-180) must not change what a new element prints as. These are the
 * values they have had since F4.
 */
export const ARTWORK_DEFAULTS = {
  text: oklchToHex({ l: 0.262, c: 0.011, h: 255 }),
  shapeFill: oklchToHex({ l: 0.658, c: 0.094, h: 183 }),
  shapeStroke: oklchToHex({ l: 0.262, c: 0.011, h: 255 }),
} as const;
