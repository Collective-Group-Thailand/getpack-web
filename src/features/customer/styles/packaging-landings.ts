/**
 * The SEO landing pages `/packaging/[slug]` (styles redesign Phase 2 §5, C0): each one a preset
 * filter of the library — one use case — with its own answer-first intro and FAQ, and the same
 * grid. Behind `FEATURE_PACKAGING_LANDINGS` until the intros (300–600 words) and FAQs are approved
 * business copy: they live in the `styles` messages as `packagingPages.<slug>.intro` and
 * `packagingPages.<slug>.faq` and are simply absent until then (the page leaves those slots out).
 */
export const PACKAGING_LANDINGS = [
  { slug: "cake-boxes", useCase: "bakery" },
  { slug: "mailer-boxes", useCase: "shipping" },
  { slug: "gift-boxes", useCase: "gift" },
  { slug: "cosmetic-boxes", useCase: "cosmetics" },
  { slug: "food-boxes", useCase: "food" },
  { slug: "fruit-boxes", useCase: "produce" },
  { slug: "apparel-boxes", useCase: "apparel" },
  { slug: "tea-coffee-boxes", useCase: "tea_coffee" },
] as const;

export type PackagingLanding = (typeof PACKAGING_LANDINGS)[number];

export const packagingHref = (slug: string) => `/packaging/${slug}`;

export const landingOfSlug = (slug: string): PackagingLanding | undefined =>
  PACKAGING_LANDINGS.find((l) => l.slug === slug);

export const landingOfUseCase = (useCase: string): PackagingLanding | undefined =>
  PACKAGING_LANDINGS.find((l) => l.useCase === useCase);
