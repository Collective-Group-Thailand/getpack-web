/**
 * Tier 2 — semantic: what a colour *means*, resolved per theme.
 *
 * Components only ever name these. Adding a key means defining it in all three themes
 * (TypeScript enforces that) and, if it is a text or UI pair, declaring it in
 * `scripts/check-contrast.ts` — the gate decides whether the value is allowed (ADR-0003).
 *
 * Key names are chosen to read well as Tailwind utilities, the way design-system.md §2
 * writes them: `bg-primary`, `text-muted`, `border-border`, `ring-focus-ring`. ADR-0003
 * spelled this tier `text` / `text-muted`; `fg` / `muted` is the same tier renamed, so
 * `--color-*` does not generate `text-text-muted`.
 */

import type { Oklch } from "./color";
import { alpha, BLACK, PALETTES as P, WHITE } from "./primitives";

interface BaseSlots {
  /** Page background, and the quieter band that separates sections. */
  bg: Oklch;
  "bg-subtle": Oklch;
  /** Cards, panels, menus — anything sitting on top of `bg`. */
  surface: Oklch;
  "surface-subtle": Oklch;
  "surface-raised": Oklch;
  /** Scrim behind dialogs and sheets. */
  overlay: Oklch;
  border: Oklch;
  "border-strong": Oklch;
  /** Body text; secondary text (still 4.5:1); de-emphasised UI text — placeholders, disabled (3:1). */
  fg: Oklch;
  muted: Oklch;
  subtle: Oklch;
  /** Text on a solid dark/brand fill. */
  "fg-inverse": Oklch;
  "primary-hover": Oklch;
  "focus-ring": Oklch;
  /** The designer's work area: neutral chrome so artwork stands out (design-system.md §5). */
  canvas: Oklch;
  "canvas-grid": Oklch;
}

const TONE_NAMES = ["primary", "success", "warning", "danger", "info", "neutral"] as const;
export type ToneName = (typeof TONE_NAMES)[number];

/** One tone's four slots: the solid fill with its text, and the quiet variant badges use. */
interface Tone {
  base: Oklch;
  fg: Oklch;
  subtle: Oklch;
  subtleFg: Oklch;
}

type ToneKey = ToneName | `${ToneName}-fg` | `${ToneName}-subtle` | `${ToneName}-subtle-fg`;

/** Every semantic key, e.g. `bg-subtle`, `primary-fg`, `danger-subtle`. */
export type SemanticKey = keyof BaseSlots | ToneKey;
export type SemanticTheme = Record<SemanticKey, Oklch>;

function build(base: BaseSlots, tones: Record<ToneName, Tone>): SemanticTheme {
  const out = { ...base } as SemanticTheme;
  for (const name of TONE_NAMES) {
    out[name] = tones[name].base;
    out[`${name}-fg`] = tones[name].fg;
    out[`${name}-subtle`] = tones[name].subtle;
    out[`${name}-subtle-fg`] = tones[name].subtleFg;
  }
  return out;
}

/** Light — the customer default and the admin zone's working theme (00-master-plan.md §2). */
const light = build(
  {
    bg: WHITE,
    "bg-subtle": P.neutral[50],
    surface: WHITE,
    "surface-subtle": P.neutral[50],
    "surface-raised": WHITE,
    overlay: alpha(P.neutral[950], 0.55),
    border: P.neutral[200],
    "border-strong": P.neutral[600],
    fg: P.neutral[900],
    muted: P.neutral[700],
    subtle: P.neutral[500],
    "fg-inverse": WHITE,
    "primary-hover": P.brand[800],
    "focus-ring": P.brand[600],
    canvas: P.neutral[100],
    "canvas-grid": P.neutral[300],
  },
  {
    primary: { base: P.brand[700], fg: WHITE, subtle: P.brand[50], subtleFg: P.brand[900] },
    success: { base: P.green[700], fg: WHITE, subtle: P.green[50], subtleFg: P.green[900] },
    // Amber is the one hue that cannot carry white text at a legible lightness, so the solid
    // warning tone flips: a bright fill with near-black text, the way road signage does it.
    warning: { base: P.amber[400], fg: P.neutral[950], subtle: P.amber[50], subtleFg: P.amber[900] },
    danger: { base: P.red[700], fg: WHITE, subtle: P.red[50], subtleFg: P.red[900] },
    info: { base: P.blue[700], fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[900] },
    neutral: { base: P.neutral[700], fg: WHITE, subtle: P.neutral[100], subtleFg: P.neutral[800] },
  },
);

/** Dark — available in every zone; the customer zone follows the OS unless `pk_theme` says otherwise. */
const dark = build(
  {
    bg: P.neutral[950],
    "bg-subtle": P.neutral[900],
    surface: P.neutral[900],
    "surface-subtle": P.neutral[800],
    "surface-raised": P.neutral[800],
    overlay: alpha(BLACK, 0.65),
    border: P.neutral[800],
    "border-strong": P.neutral[500],
    fg: P.neutral[50],
    muted: P.neutral[300],
    subtle: P.neutral[400],
    "fg-inverse": P.neutral[950],
    "primary-hover": P.brand[300],
    "focus-ring": P.brand[400],
    canvas: P.neutral[900],
    "canvas-grid": P.neutral[700],
  },
  {
    primary: { base: P.brand[400], fg: P.neutral[950], subtle: P.brand[950], subtleFg: P.brand[300] },
    success: { base: P.green[400], fg: P.neutral[950], subtle: P.green[950], subtleFg: P.green[300] },
    warning: { base: P.amber[400], fg: P.neutral[950], subtle: P.amber[950], subtleFg: P.amber[300] },
    danger: { base: P.red[400], fg: P.neutral[950], subtle: P.red[950], subtleFg: P.red[300] },
    info: { base: P.blue[400], fg: P.neutral[950], subtle: P.blue[950], subtleFg: P.blue[300] },
    neutral: { base: P.neutral[400], fg: P.neutral[950], subtle: P.neutral[800], subtleFg: P.neutral[200] },
  },
);

/**
 * High contrast — the partner PWA's shop-floor option (design-system.md §5): black on white,
 * heavy borders, every tone at its darkest step so a status reads across a factory floor.
 */
const hc = build(
  {
    bg: WHITE,
    "bg-subtle": WHITE,
    surface: WHITE,
    "surface-subtle": P.neutral[50],
    "surface-raised": WHITE,
    overlay: alpha(BLACK, 0.7),
    border: P.neutral[700],
    "border-strong": BLACK,
    fg: BLACK,
    muted: P.neutral[900],
    subtle: P.neutral[800],
    "fg-inverse": WHITE,
    "primary-hover": P.brand[950],
    "focus-ring": BLACK,
    canvas: WHITE,
    "canvas-grid": P.neutral[500],
  },
  {
    primary: { base: P.brand[900], fg: WHITE, subtle: P.brand[50], subtleFg: P.brand[950] },
    success: { base: P.green[900], fg: WHITE, subtle: P.green[50], subtleFg: P.green[950] },
    warning: { base: P.amber[300], fg: BLACK, subtle: P.amber[50], subtleFg: P.amber[950] },
    danger: { base: P.red[900], fg: WHITE, subtle: P.red[50], subtleFg: P.red[950] },
    info: { base: P.blue[900], fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[950] },
    neutral: { base: BLACK, fg: WHITE, subtle: P.neutral[100], subtleFg: BLACK },
  },
);

export const THEMES = { light, dark, hc } as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const SEMANTIC_KEYS = Object.keys(light) as SemanticKey[];
