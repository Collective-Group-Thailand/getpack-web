/**
 * Tier 1 — primitives: the raw palette and nothing else.
 *
 * Authored in OKLCH (ADR-0003) so a palette keeps one perceived lightness ramp across every
 * hue: `red-700` and `brand-700` are equally dark, which is what makes the semantic tier
 * swappable and the contrast gate predictable. Never reference a primitive from a component —
 * go through `semantic.ts`, or the gate cannot see what you did.
 */

import type { Oklch } from "./color";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];

/** Shared lightness ramp. Every palette uses it, so steps are comparable across hues. */
const LIGHTNESS: Record<Step, number> = {
  50: 0.985,
  100: 0.962,
  200: 0.918,
  300: 0.855,
  400: 0.762,
  500: 0.658,
  600: 0.588,
  700: 0.505,
  800: 0.428,
  900: 0.352,
  950: 0.262,
};

/** Chroma as a fraction of the palette's peak: saturated in the middle, calm at both ends. */
const CHROMA_CURVE: Record<Step, number> = {
  50: 0.06,
  100: 0.14,
  200: 0.28,
  300: 0.48,
  400: 0.74,
  500: 0.94,
  600: 1,
  700: 0.94,
  800: 0.82,
  900: 0.68,
  950: 0.5,
};

export type Palette = Record<Step, Oklch>;

function palette(hue: number, peakChroma: number): Palette {
  return Object.fromEntries(
    STEPS.map((step) => [step, { l: LIGHTNESS[step], c: peakChroma * CHROMA_CURVE[step], h: hue }]),
  ) as Palette;
}

export const WHITE: Oklch = { l: 1, c: 0, h: 0 };
export const BLACK: Oklch = { l: 0, c: 0, h: 0 };

/** Transparent black/white for scrims and hairlines, where a solid colour would hide content. */
export const alpha = (colour: Oklch, a: number): Oklch => ({ ...colour, a });

export const PALETTES = {
  /** Slightly cool grey — the chrome of every zone. */
  neutral: palette(255, 0.022),
  /**
   * Brand teal. PLACEHOLDER until the brand kit lands (docs/ui/brand.md); it is the hue
   * BoxStudio shipped, kept so the rebrand is not also a visual redesign.
   */
  brand: palette(183, 0.1),
  green: palette(152, 0.15),
  amber: palette(74, 0.15),
  red: palette(24, 0.2),
  blue: palette(258, 0.17),
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/**
 * Print marks, not UI colour: the dieline's cut / fold / safe-zone / bleed lines.
 *
 * They are deliberately outside the themes — a cut line means the same thing in dark mode,
 * and the same values go to Konva, the SVG export and the print PDF, where CSS variables
 * cannot reach. Kept here so `pnpm tokens` emits them as variables for the on-screen legend
 * as well.
 */
export const PRINT = {
  cut: PALETTES.red[600],
  fold: PALETTES.blue[600],
  safe: PALETTES.green[600],
  bleed: PALETTES.amber[600],
} as const satisfies Record<string, Oklch>;

export type PrintMark = keyof typeof PRINT;
