/**
 * Tier 1 — the non-colour primitives: space, radius, elevation, motion, type.
 *
 * Values come from design-system.md §2: 4-px spacing base, radius 4/8/12/16/full, a subtle
 * 0–4 elevation scale, motion 120/200/320 ms honouring `prefers-reduced-motion`, and a fluid
 * type scale 12→48 with Thai body line-height ≥ 1.6.
 */

/** 4-px base. Tailwind's own `--spacing` multiplier, so `p-4` stays 16 px. */
export const SPACING_BASE = "0.25rem";

export const RADIUS = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

/**
 * Elevation 0–4, deliberately soft. Shadows are tinted with the neutral hue rather than
 * pure black so they do not muddy the surface under them.
 */
export const SHADOW = {
  none: "none",
  sm: "0 1px 2px 0 oklch(20% 0.02 255 / 0.06)",
  md: "0 2px 4px -1px oklch(20% 0.02 255 / 0.08), 0 1px 2px -1px oklch(20% 0.02 255 / 0.06)",
  lg: "0 8px 16px -4px oklch(20% 0.02 255 / 0.1), 0 2px 6px -2px oklch(20% 0.02 255 / 0.06)",
  xl: "0 20px 32px -8px oklch(20% 0.02 255 / 0.14), 0 4px 10px -4px oklch(20% 0.02 255 / 0.08)",
} as const;

export const DURATION = {
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
} as const;

export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasised: "cubic-bezier(0.3, 0, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Fluid type scale. Each step interpolates between a 360-px phone and a 1280-px desktop,
 * so a Thai heading never has to be re-tuned per breakpoint.
 */
export const FONT_SIZE = {
  xs: "clamp(0.75rem, 0.73rem + 0.09vw, 0.8125rem)",
  sm: "clamp(0.875rem, 0.85rem + 0.11vw, 0.9375rem)",
  base: "1rem",
  lg: "clamp(1.125rem, 1.1rem + 0.13vw, 1.1875rem)",
  xl: "clamp(1.25rem, 1.19rem + 0.27vw, 1.375rem)",
  "2xl": "clamp(1.5rem, 1.39rem + 0.54vw, 1.75rem)",
  "3xl": "clamp(1.875rem, 1.66rem + 0.98vw, 2.25rem)",
  "4xl": "clamp(2.25rem, 1.87rem + 1.7vw, 3rem)",
} as const;

/** Thai needs room for upper vowels and tone marks: body ≥ 1.6, headings no tighter than 1.25. */
export const LINE_HEIGHT = {
  tight: "1.25",
  snug: "1.4",
  normal: "1.6",
  relaxed: "1.75",
} as const;

export const FONT_WEIGHT = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Font stacks. The `--font-pk-*` variables are produced by `next/font/local`
 * (`src/ui/fonts`); Latin comes first so the metric-matched Latin companion wins for
 * ASCII, and Thai codepoints fall through to the Thai subset (ADR-0001).
 */
export const FONT_FAMILY = {
  sans: "var(--font-pk-sans-latin), var(--font-pk-sans-thai), ui-sans-serif, system-ui, sans-serif",
  display: "var(--font-pk-display-latin), var(--font-pk-display-thai), var(--font-pk-sans-latin), sans-serif",
  mono: "var(--font-pk-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Stacking order. Overlays come from Radix portals, so only a few levels are needed. */
export const Z_INDEX = {
  base: "0",
  sticky: "30",
  overlay: "40",
  modal: "50",
  toast: "60",
} as const;
