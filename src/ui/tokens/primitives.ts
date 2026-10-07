/**
 * Tier 1 — primitives: the raw palette and nothing else.
 *
 * Authored in OKLCH (ADR-0003) so a palette keeps one perceived lightness ramp across every
 * hue: `red-700` and `brand-700` are equally dark, which is what makes the semantic tier
 * swappable and the contrast gate predictable. Never reference a primitive from a component —
 * go through `semantic.ts`, or the gate cannot see what you did.
 */

import { hexToOklch, type Oklch } from "./color";

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

/**
 * Ramps for every slot the art direction (D-180) does not name — placeholders, input outlines,
 * the designer's canvas, badge tints, the dark and high-contrast steps. Each is tuned to the
 * hue of the art-direction colour it sits beside, so a derived step never looks borrowed from
 * another palette.
 */
export const PALETTES = {
  /** Warm grey on the hue of the ink (`#1E1B18` / `#5B534B`) — the chrome of every zone. */
  neutral: palette(72, 0.022),
  /**
   * Deep teal-green on the hue of `--c-primary-600` (`#0D7A66`). Replaced wholesale when the
   * brand kit lands (docs/ui/brand.md).
   */
  brand: palette(176, 0.1),
  /** Status hues, each on the hue of its art-direction colour. */
  green: palette(150, 0.15),
  /** Warning (`#B45309`): burnt orange, kept visibly apart from the promotional amber. */
  orange: palette(49, 0.16),
  /** Promotions only (`#E08A18`, D-180). */
  amber: palette(66, 0.16),
  red: palette(29, 0.19),
  blue: palette(264, 0.2),
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/** One theme's art-direction colours, named as `design-system.md` §Art direction names them. */
export interface ArtSet {
  "paper-50": Oklch;
  "paper-100": Oklch;
  surface: Oklch;
  "kraft-200": Oklch;
  "kraft-400": Oklch;
  border: Oklch;
  "ink-900": Oklch;
  "ink-600": Oklch;
  "ink-300": Oklch;
  sage: Oklch;
  "sage-50": Oklch;
  "primary-600": Oklch;
  "primary-700": Oklch;
  "primary-50": Oklch;
  "accent-500": Oklch;
}

const art = (values: Record<keyof ArtSet, string>): ArtSet =>
  Object.fromEntries(Object.entries(values).map(([key, hex]) => [key, hexToOklch(hex)])) as unknown as ArtSet;

/**
 * The D-180 palette, as design language v3 (Phase 4, the "Main" board of the V4 design file)
 * names it: paper `#F6F3EE`, ink `#1D1B17` / `#5D5850` / `#948D83`, hairline `#E4DFD6`, sage
 * `#5F7264` / `#E7EBE5`, green `#0F5F4E` / `#0B4A3D`, kraft `#DCCDB3`. Hex in, so a brand kit is
 * pasted rather than translated; `semantic.ts` decides where each one goes and
 * `scripts/check-contrast.ts` decides whether it may.
 */
export const ART = {
  light: art({
    "paper-50": "#F6F3EE",
    "paper-100": "#EFEBE4",
    surface: "#FFFFFF",
    "kraft-200": "#DCCDB3",
    "kraft-400": "#C8A97B",
    border: "#E4DFD6",
    "ink-900": "#1D1B17",
    "ink-600": "#5D5850",
    "ink-300": "#948D83",
    sage: "#5F7264",
    "sage-50": "#E7EBE5",
    "primary-600": "#0F5F4E",
    "primary-700": "#0B4A3D",
    "primary-50": "#E7EBE5",
    "accent-500": "#E08A18",
  }),
  dark: art({
    "paper-50": "#17140F",
    "paper-100": "#1F1B15",
    surface: "#262119",
    "kraft-200": "#3A3126",
    "kraft-400": "#C8A97B",
    border: "#3A3229",
    "ink-900": "#F7F3EC",
    "ink-600": "#C3BAAE",
    "ink-300": "#968D80",
    sage: "#8FA394",
    "sage-50": "#1F2621",
    "primary-600": "#2AA88E",
    // The spec proposes #0D7A66 here; it fails the gate in dark (see semantic.ts), so the
    // hover the dark theme actually uses is a lighter step, and this value is kept only as
    // the record of what was proposed.
    "primary-700": "#0D7A66",
    "primary-50": "#123029",
    "accent-500": "#F0A63A",
  }),
} as const;

/** Status colours for the light theme (§Art direction); dark uses the lighter ramp steps. */
export const STATUS = {
  success: hexToOklch("#15803D"),
  warning: hexToOklch("#B45309"),
  danger: hexToOklch("#B42318"),
  info: hexToOklch("#1D4ED8"),
} as const satisfies Record<string, Oklch>;

/**
 * Print marks, not UI colour: the dieline's cut / fold / safe-zone / bleed lines.
 *
 * They are deliberately outside the themes — a cut line means the same thing in dark mode,
 * and the same values go to Konva, the SVG export and the print PDF, where CSS variables
 * cannot reach. Kept here so `pnpm tokens` emits them as variables for the on-screen legend
 * as well.
 *
 * Literal values, not palette steps: a UI rebrand (D-180) must never move a line a factory
 * cuts or folds along. These are the values the marks have had since F0.
 */
export const PRINT = {
  cut: { l: 0.588, c: 0.2, h: 24 },
  fold: { l: 0.588, c: 0.17, h: 258 },
  safe: { l: 0.588, c: 0.15, h: 152 },
  bleed: { l: 0.588, c: 0.15, h: 74 },
} as const satisfies Record<string, Oklch>;

export type PrintMark = keyof typeof PRINT;
