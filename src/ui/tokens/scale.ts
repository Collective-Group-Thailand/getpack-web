/**
 * Tier 1 — the non-colour primitives: space, radius, elevation, motion, type.
 *
 * Values come from design-system.md §2 (4-px spacing, radius 4/8/12/16/full, fluid type
 * 12→48 with Thai body line-height ≥ 1.6), refined by §Art direction (D-180): 12-px controls,
 * 16-px cards, pill CTAs on the storefront only, two elevation levels, and 150/200/250 ms
 * ease-out motion honouring `prefers-reduced-motion`.
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
  /** Buttons, inputs, selects, segmented controls — every zone, admin included (D-180). */
  control: "0.75rem",
  /**
   * Cards, media, dialogs, the quote dock: 20 px on the storefront (UX audit design baseline);
   * `build-tokens.ts` brings it back to 16 px in the denser admin and partner zones.
   */
  card: "1.25rem",
  /** Hero pictures and full-width bands (UX audit: "hero/band 28"). */
  band: "1.75rem",
  /**
   * The primary call to action. A control everywhere, and a **pill on the storefront only**:
   * `build-tokens.ts` overrides it under `[data-zone="customer"]`, which each root layout
   * stamps on `<html>`. The admin keeps 12 px.
   */
  cta: "0.75rem",
} as const;

/** The value `--radius-cta` takes in the customer zone. */
export const CUSTOMER_CTA_RADIUS = "9999px";

/** The card radius in the admin and partner zones, which run denser (UX audit: "radius card 16"). */
export const DENSE_CARD_RADIUS = "1rem";

/**
 * Content widths (UX audit design baseline): storefront content 1180 px, its navbar 1320 px, the
 * admin's full width capped at 1440 px. Tailwind turns `--container-*` into `max-w-*`.
 */
export const CONTAINER = {
  content: "73.75rem",
  nav: "82.5rem",
  console: "90rem",
} as const;

/**
 * Two elevation levels only (D-180), tinted with the warm ink (#1E1B18) rather than black
 * so they do not muddy the paper under them. No neumorphism, no double borders.
 */
export const SHADOW = {
  none: "none",
  /** Cards and anything resting on the page. */
  card: "0 1px 2px rgb(30 27 24 / 0.06)",
  /** Menus, popovers, dialogs, sheets, the sticky quote dock. */
  overlay: "0 8px 24px rgb(30 27 24 / 0.1)",
  /** A card lifted on hover — only on hover (UX audit: no shadow on a resting card). */
  lift: "0 20px 40px -24px rgb(60 40 20 / 0.35)",
  /** The primary button's faint brand glow; `none` outside the storefront (see build-tokens.ts). */
  cta: "none",
} as const;

/** `--shadow-cta` in the customer zone: the primary colour, faint, below the button. */
/** Design language v2: `0 14px 28px -14px rgba(13,122,102,.7)` in the light theme, from the primary token. */
export const CUSTOMER_CTA_SHADOW = "0 14px 28px -14px color-mix(in oklab, var(--color-primary) 70%, transparent)";

/** Design language v2: storefront cards are 22 px (the back office keeps 16, `DENSE_CARD_RADIUS`). */
export const CUSTOMER_CARD_RADIUS = "1.375rem";

/** Hovers 150–200 ms, sheets and drawers 250 ms (D-180). */
export const DURATION = {
  fast: "150ms",
  base: "200ms",
  slow: "250ms",
} as const;

export const EASING = {
  /** Ease-out: hovers and anything entering. */
  standard: "cubic-bezier(0, 0, 0.2, 1)",
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
  /** A page title: 38 px on a desktop (UX audit type scale 64 / 48 / 38). */
  "3xl": "clamp(1.875rem, 1.6rem + 1.2vw, 2.375rem)",
  /** A section opener: 48 px. */
  "4xl": "clamp(2.25rem, 1.87rem + 1.7vw, 3rem)",
  /** The page's one h1 on marketing pages — the hero (D-180): 64 px on a desktop. */
  display: "clamp(2.5rem, 1.6rem + 3.6vw, 4rem)",
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
 *
 * One family for body and headings — Anuphan, Thai and Latin (UX audit design baseline: "ฟอนต์
 * ไทย/ละตินชุดเดียว เพื่อให้ x-height เท่ากัน"); Noto Sans Thai is no longer loaded.
 */
export const FONT_FAMILY = {
  sans: "var(--font-pk-display-latin), var(--font-pk-display-thai), ui-sans-serif, system-ui, sans-serif",
  /** Trirong (design language v2): headings by zone — see `src/ui/styles/base.css`. */
  display: "var(--font-pk-serif-latin), var(--font-pk-serif-thai), ui-serif, Georgia, serif",
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
