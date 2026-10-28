import styles from "@/i18n/messages/th/customer/styles.json";

/**
 * The SEO landing pages `/packaging/[slug]` (styles redesign Phase 2 §5, C0): each one a preset
 * filter of the library — one use case — with its own answer-first intro and FAQ, and the same
 * grid. Behind `FEATURE_PACKAGING_LANDINGS` until the intros (300–600 words) and FAQs are approved
 * business copy: they live in the `styles` messages as `packagingPages.<slug>.intro` and
 * `packagingPages.<slug>.faq` and are simply absent until then (the page leaves those slots out).
 *
 * C0b (DECISIONS-STAGE-A §9.4b): each page's copy carries `packagingPages.<slug>.status` — `draft` (written
 * from repo facts, waiting for the owner) or `approved`. A draft is shown only while the flag is on (review on
 * UAT), with `noindex`, no FAQPage JSON-LD and no sitemap / llms.txt entry; the owner approves by setting
 * `approved` in both locales.
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

export type LandingCopyStatus = "approved" | "draft" | "none";

/** The review state of a page's copy (the same in every locale; the Thai messages are the source). */
export function landingCopyStatus(slug: string): LandingCopyStatus {
  const page = (styles.packagingPages as Record<string, { status?: string } | undefined>)[slug];
  if (!page) return "none";
  return page.status === "approved" ? "approved" : "draft";
}

/** Published = flag on (checked by the caller) and copy approved: only then indexed, in the sitemap and llms.txt. */
export const isLandingPublished = (slug: string) => landingCopyStatus(slug) === "approved";

export const landingOfUseCase = (useCase: string): PackagingLanding | undefined =>
  PACKAGING_LANDINGS.find((l) => l.useCase === useCase);
