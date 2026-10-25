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

import { hexToOklch, type Oklch } from "./color";
import { alpha, ART, BLACK, PALETTES as P, STATUS, WHITE } from "./primitives";

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
  /** Hover fill for the destructive button. Dimming with opacity would dim its label too. */
  "danger-hover": Oklch;
  "focus-ring": Oklch;
  /** The designer's work area: neutral chrome so artwork stands out (design-system.md §5). */
  canvas: Oklch;
  "canvas-grid": Oklch;
  /**
   * Kraft (D-180): decorative fills and dieline illustration only — never text, never a
   * control. The contrast gate checks them as decoration, and ESLint bans `text-kraft*`.
   */
  kraft: Oklch;
  "kraft-strong": Oklch;
  /**
   * Sage (design language v3): the quiet green of a full-width band and of a template card's
   * picture well. `sage` carries white text; `sage-subtle` carries ink. `sage-strong` is a quieter
   * panel inside the band where a photo would sit — decoration, never text.
   */
  sage: Oklch;
  "sage-subtle": Oklch;
  "sage-strong": Oklch;
}

/**
 * `accent` is amber and exists for **promotions only** (D-180): campaign badges, "ราคาพิเศษ".
 * Teal (`primary`) is for actions and links. A warning is `warning`, which is deliberately a
 * different, burnt-orange hue so it can never be mistaken for a campaign.
 */
const TONE_NAMES = ["primary", "accent", "success", "warning", "danger", "info", "neutral", "instant"] as const;

/**
 * `instant` marks a style with an instant price — the one fact on a library card that really differs
 * from card to card (styles redesign, PLAN.md C5). An ochre deliberately darker and browner than the
 * promotional `accent`, always as text on its tint with an icon, never a solid amber fill, so it does
 * not read as a campaign (D-180).
 */
const INSTANT = {
  light: { ink: hexToOklch("#8F530E"), tint: hexToOklch("#F6EAD9") },
  dark: { ink: hexToOklch("#E7AA60"), tint: hexToOklch("#33271A") },
};
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

const L = ART.light;
const D = ART.dark;

/**
 * Light — the customer default and the admin zone's working theme (00-master-plan.md §2).
 * Near-white neutral page, white cards, cool ink text, one teal for actions (D-180).
 */
const light = build(
  {
    bg: L["paper-50"],
    "bg-subtle": L["paper-100"],
    surface: L.surface,
    "surface-subtle": L["paper-50"],
    "surface-raised": L.surface,
    overlay: alpha(P.neutral[950], 0.55),
    border: L.border,
    "border-strong": P.neutral[600],
    fg: L["ink-900"],
    muted: L["ink-600"],
    // One notch darker than ramp step 500: on the warm paper page that step gives 2.97:1,
    // just under the 3:1 placeholders need.
    // v3's ink-3 (#948D83) gives 2.97:1 on the paper page, a hair under the 3:1 placeholders need,
    // so it goes one notch darker. Captions are text, not decoration: they use `muted` (AA).
    subtle: { ...L["ink-300"], l: L["ink-300"].l - 0.008 },
    "fg-inverse": WHITE,
    "primary-hover": L["primary-700"],
    "danger-hover": P.red[800],
    "focus-ring": L["primary-600"],
    canvas: P.neutral[100],
    "canvas-grid": P.neutral[300],
    kraft: L["kraft-200"],
    "kraft-strong": L["kraft-400"],
    sage: L.sage,
    "sage-subtle": L["sage-50"],
    "sage-strong": { ...L.sage, l: L.sage.l - 0.08 },
  },
  {
    primary: { base: L["primary-600"], fg: WHITE, subtle: L["primary-50"], subtleFg: L["primary-700"] },
    // Amber cannot carry white text at this lightness (2.69:1), so a campaign badge is amber
    // with ink, the way road signage does it.
    accent: { base: L["accent-500"], fg: L["ink-900"], subtle: P.amber[100], subtleFg: P.amber[900] },
    success: { base: STATUS.success, fg: WHITE, subtle: P.green[50], subtleFg: P.green[900] },
    warning: { base: STATUS.warning, fg: WHITE, subtle: P.orange[50], subtleFg: P.orange[900] },
    danger: { base: STATUS.danger, fg: WHITE, subtle: P.red[50], subtleFg: P.red[900] },
    info: { base: STATUS.info, fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[900] },
    neutral: { base: P.neutral[700], fg: WHITE, subtle: P.neutral[100], subtleFg: P.neutral[800] },
    instant: { base: INSTANT.light.ink, fg: WHITE, subtle: INSTANT.light.tint, subtleFg: INSTANT.light.ink },
  },
);

/** Dark — available in every zone; only shown when `pk_theme` asks for it (or for `system` on a dark OS). */
const dark = build(
  {
    bg: D["paper-50"],
    "bg-subtle": D["paper-100"],
    surface: D.surface,
    "surface-subtle": D["paper-100"],
    // Not in the spec: menus and popovers need to sit one step above a dark card.
    "surface-raised": { ...D.surface, l: D.surface.l + 0.04 },
    overlay: alpha(BLACK, 0.65),
    border: D.border,
    "border-strong": P.neutral[500],
    fg: D["ink-900"],
    muted: D["ink-600"],
    subtle: P.neutral[400],
    "fg-inverse": D["paper-50"],
    /*
     * Adjusted from the proposal. The spec's dark primary-700 (#0D7A66) gives 3.26:1 under the
     * dark button label and 3.49:1 as a hovered link, so hovering in dark goes one ramp step
     * *lighter* instead of darker — the smallest change that keeps both pairs at AA.
     */
    "primary-hover": P.brand[400],
    "danger-hover": P.red[300],
    "focus-ring": D["primary-600"],
    canvas: P.neutral[950],
    "canvas-grid": P.neutral[800],
    kraft: D["kraft-200"],
    "kraft-strong": D["kraft-400"],
    sage: D.sage,
    "sage-subtle": D["sage-50"],
    "sage-strong": { ...D.sage, l: D.sage.l - 0.08 },
  },
  {
    primary: { base: D["primary-600"], fg: D["paper-50"], subtle: D["primary-50"], subtleFg: P.brand[300] },
    accent: { base: D["accent-500"], fg: D["paper-50"], subtle: P.amber[950], subtleFg: P.amber[300] },
    success: { base: P.green[400], fg: D["paper-50"], subtle: P.green[950], subtleFg: P.green[300] },
    warning: { base: P.orange[400], fg: D["paper-50"], subtle: P.orange[950], subtleFg: P.orange[300] },
    danger: { base: P.red[400], fg: D["paper-50"], subtle: P.red[950], subtleFg: P.red[300] },
    info: { base: P.blue[400], fg: D["paper-50"], subtle: P.blue[950], subtleFg: P.blue[300] },
    neutral: { base: P.neutral[400], fg: D["paper-50"], subtle: P.neutral[800], subtleFg: P.neutral[200] },
    instant: { base: INSTANT.dark.ink, fg: D["paper-50"], subtle: INSTANT.dark.tint, subtleFg: INSTANT.dark.ink },
  },
);

/**
 * High contrast — the partner PWA's shop-floor option (design-system.md §5): black on white,
 * heavy borders, every tone at its darkest step so a status reads across a factory floor.
 * The hues are the art direction's; only the lightness is pushed.
 */
const hc = build(
  {
    bg: WHITE,
    "bg-subtle": WHITE,
    surface: WHITE,
    "surface-subtle": L["paper-50"],
    "surface-raised": WHITE,
    overlay: alpha(BLACK, 0.7),
    border: P.neutral[700],
    "border-strong": BLACK,
    fg: BLACK,
    muted: P.neutral[900],
    subtle: P.neutral[800],
    "fg-inverse": WHITE,
    "primary-hover": P.brand[950],
    "danger-hover": P.red[950],
    "focus-ring": BLACK,
    canvas: WHITE,
    "canvas-grid": P.neutral[500],
    kraft: L["kraft-200"],
    "kraft-strong": L["kraft-400"],
    sage: { ...L.sage, l: 0.36 },
    "sage-subtle": WHITE,
    "sage-strong": { ...L.sage, l: 0.28 },
  },
  {
    primary: { base: P.brand[900], fg: WHITE, subtle: P.brand[50], subtleFg: P.brand[950] },
    accent: { base: L["accent-500"], fg: BLACK, subtle: P.amber[50], subtleFg: P.amber[950] },
    success: { base: P.green[900], fg: WHITE, subtle: P.green[50], subtleFg: P.green[950] },
    warning: { base: P.orange[900], fg: WHITE, subtle: P.orange[50], subtleFg: P.orange[950] },
    danger: { base: P.red[900], fg: WHITE, subtle: P.red[50], subtleFg: P.red[950] },
    info: { base: P.blue[900], fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[950] },
    neutral: { base: BLACK, fg: WHITE, subtle: P.neutral[100], subtleFg: BLACK },
    instant: { base: P.amber[950], fg: WHITE, subtle: P.amber[50], subtleFg: P.amber[950] },
  },
);

export const THEMES = { light, dark, hc } as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const SEMANTIC_KEYS = Object.keys(light) as SemanticKey[];
