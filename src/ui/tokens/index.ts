/**
 * The design tokens (ADR-0003), tier by tier:
 *   primitives.ts  the raw OKLCH palette + print marks
 *   scale.ts       space, radius, elevation, motion, type
 *   semantic.ts    what a colour means, per theme — the only tier components may name
 *   color.ts       OKLCH → sRGB, luminance, WCAG contrast (used by the generator and gate)
 *
 * Components read colour through Tailwind utilities backed by `--color-*`, never by
 * importing from here. These exports exist for the code that genuinely needs a *value*:
 * the token generator, the contrast gate, Storybook's swatch docs, and the canvas/print
 * code where CSS variables cannot reach (Konva, SVG and PDF export).
 */

export { contrastRatio, oklchCss, oklchToHex, relativeLuminance, type Oklch } from "./color";
export { alpha, BLACK, PALETTES, PRINT, STEPS, WHITE, type PaletteName, type PrintMark, type Step } from "./primitives";
export {
  CUSTOMER_CARD_RADIUS,
  CUSTOMER_CTA_RADIUS,
  DURATION,
  EASING,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  RADIUS,
  SHADOW,
  SPACING_BASE,
  Z_INDEX,
} from "./scale";
export {
  SEMANTIC_KEYS,
  THEME_NAMES,
  THEMES,
  type SemanticKey,
  type SemanticTheme,
  type ThemeName,
  type ToneName,
} from "./semantic";
