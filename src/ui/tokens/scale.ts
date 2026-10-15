/**
 * Tier 1 — the non-colour primitives: space, radius, elevation, motion, type.
 *
 * Values come from design-system.md §2 (4-px spacing, fluid type 12→48 with Thai body
 * line-height ≥ 1.6), refined by §Art direction (D-180) and design language v3 (Phase 4):
 * radius 10 control / 14 card / 16 panel / 6 thumb and circles, no pills, no button shadows,
 * and 150/200/250 ms ease-out motion honouring `prefers-reduced-motion`.
 */

/** 4-px base. Tailwind's own `--spacing` multiplier, so `p-4` stays 16 px. */
export const SPACING_BASE = "0.25rem";

export const RADIUS = {
  /*
   * Design language v3 (Phase 4) has four radii and nothing else; the Tailwind steps alias them
   * so an existing `rounded-lg` lands on one of the four instead of a fifth value.
   */
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.625rem",
  xl: "0.875rem",
  "2xl": "1rem",
  /** Circles only — an avatar, a status dot. Never a pill: CI refuses `rounded-full` on a non-square. */
  full: "9999px",
  /** Buttons, inputs, selects, chips, tags, segmented controls — every zone: 10 px. */
  control: "0.625rem",
  /** Cards, panels, list rows, dialogs, the quote dock — every zone: 14 px. */
  card: "0.875rem",
  /** The hero's Studio panel, a full-width picture: 16 px. */
  panel: "1rem",
  /** Dieline thumbnails and small pictures: 6 px. */
  thumb: "0.375rem",
  /** Hero pictures and bands — the panel radius (kept as a name so older call sites resolve). */
  band: "1rem",
  /** The primary call to action: a control, in every zone (no pill CTAs in v3). */
  cta: "0.625rem",
} as const;

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
  /** The hero's Studio panel — the one resting shadow design language v3 keeps. */
  panel: "0 24px 60px -30px rgb(29 27 23 / 0.25)",
  /** Buttons carry no shadow in v3; the name stays so a call site resolves to nothing. */
  cta: "none",
} as const;

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
  /** 14 px everywhere (design-system scale 12/14/16; the v2 boards' controls and lists). */
  sm: "0.875rem",
  base: "1rem",
  lg: "clamp(1.125rem, 1.1rem + 0.13vw, 1.1875rem)",
  xl: "clamp(1.25rem, 1.19rem + 0.27vw, 1.375rem)",
  "2xl": "clamp(1.5rem, 1.39rem + 0.54vw, 1.75rem)",
  /**
   * The title of a working page — the account, cart, checkout, a form: 24 px on a phone, 28 px on
   * a desktop. The 32 px those pages used read as oversized next to their own lists and forms
   * (owner feedback 2026-10-14); the marketing scale below is for pages that sell, not pages
   * that work.
   */
  title: "clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem)",
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
  /** One face for the whole site: display text is Anuphan too, set heavier and tighter (base.css). */
  display: "var(--font-pk-display-latin), var(--font-pk-display-thai), ui-sans-serif, system-ui, sans-serif",
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
