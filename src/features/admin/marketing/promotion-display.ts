/**
 * Loyalty P1.5: what the promotion editor's "การแสดงผล" tab edits (`admin.promotions.update` → `visibility`,
 * `display`) and the rules it shows before publishing — the API's publish guard, mirrored so the button says why it
 * waits. The API still decides: it answers 422 `promotions.not_publishable` with each failed rule in `errors[]`, and
 * 409 `promotions.slug_taken`.
 */

import { compareDecimal } from "@/features/shared/deals/model";
import type { Deal, DealBenefit } from "@/features/shared/deals/types";
import type { Schemas } from "@/lib/api/types";

export type PromotionVisibility = Schemas["PromotionVisibility"];
type Localized = { th: string; en: string };

/** The editor's draft: every text a pair of strings (the API stores a missing English as null). */
export interface DisplayDraft {
  headline: Localized;
  subline: Localized;
  badge: Localized | null;
  terms: Localized;
  featured: boolean;
  slug: string;
}

export const EMPTY_DISPLAY: DisplayDraft = {
  headline: { th: "", en: "" },
  subline: { th: "", en: "" },
  badge: null,
  terms: { th: "", en: "" },
  featured: false,
  slug: "",
};

const pairOf = (text: Schemas["LocalTextDto"] | null | undefined): Localized => ({
  th: text?.th ?? "",
  en: text?.en ?? "",
});

/** The saved display as a draft; a promotion never shown has empty texts. */
export function draftOf(display: Schemas["PromotionDto"]["display"] | null | undefined): DisplayDraft {
  if (!display) return EMPTY_DISPLAY;
  return {
    headline: pairOf(display.headline),
    subline: pairOf(display.subline),
    badge: display.badge ? pairOf(display.badge) : null,
    terms: pairOf(display.terms),
    featured: display.featured,
    slug: display.slug ?? "",
  };
}

/** The draft as `display` for `admin.promotions.update`: blanks are null, an empty optional text is no text. */
export function displayInput(draft: DisplayDraft): Schemas["PromotionDisplayInputDto"] {
  const text = (pair: Localized | null, required: boolean): Schemas["LocalTextDto"] | null => {
    if (!pair) return null;
    const th = pair.th.trim();
    const en = pair.en.trim();
    if (!required && !th && !en) return null;
    return { th, en: en || null };
  };
  return {
    headline: text(draft.headline, true),
    subline: text(draft.subline, false),
    badge: text(draft.badge, false),
    terms: text(draft.terms, true),
    featured: draft.featured,
    slug: draft.slug.trim() || null,
  };
}

/** What the published `PromotionDto` carries for the deals surface. */
export function publicFieldsOf(item: Schemas["PromotionDto"]): {
  visibility: PromotionVisibility;
  display: DisplayDraft;
  heroImageUrl: string | null;
} {
  return {
    visibility: item.visibility ?? "hidden",
    display: draftOf(item.display),
    heroImageUrl: item.heroImageUrl ?? null,
  };
}

/**
 * Words a public deal may not use (D-481, GLOBAL-RULES §1–§2) — the API refuses them too. Loyalty P2 adds the audience
 * words (publish guard `audience_words`): a deal never tells a customer they were picked for not ordering or for
 * their business type.
 */
export const BLOCKED_WORDS =
  /โรงงาน|factory|กำไร|margin|ทันที|นับถอยหลัง|countdown|flash\s*sale|ไม่ได้สั่ง|ห่างหาย|inactive|ประเภทธุรกิจ|business\s*type/i;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublishCheck = "active" | "slug" | "headline" | "terms" | "words";

/** Each guard condition and whether it holds, in the order the panel lists them. */
export function publishChecks(
  status: Schemas["PromotionStatus"],
  display: DisplayDraft,
): Record<PublishCheck, boolean> {
  const text = [display.headline, display.subline, display.terms, display.badge]
    .flatMap((entry) => (entry ? [entry.th, entry.en] : []))
    .join(" ");
  return {
    active: status === "active",
    slug: SLUG.test(display.slug.trim()),
    headline: display.headline.th.trim() !== "",
    terms: display.terms.th.trim() !== "",
    words: !BLOCKED_WORDS.test(text),
  };
}

export const canPublish = (checks: Record<PublishCheck, boolean>) => Object.values(checks).every(Boolean);

const BENEFIT_KIND: Partial<Record<Schemas["PromotionBenefitType"], DealBenefit["kind"]>> = {
  percent: "percent",
  fixed: "amount",
  tiered: "tiered",
  free_shipping: "free_shipping",
  points_multiplier: "points_multiplier",
};

/** The figure the API's deal card would carry for this benefit (the top tier for a tiered one). */
function previewValue(benefit: Schemas["PromotionDto"]["benefit"], kind: DealBenefit["kind"]): string | null {
  switch (kind) {
    case "percent":
      return benefit.pct ?? null;
    case "amount":
      return benefit.amount ?? null;
    case "points_multiplier":
      return benefit.multiplier ?? null;
    case "tiered": {
      const top = [...(benefit.tiers ?? [])].sort((a, b) => compareDecimal(a.min, b.min)).at(-1);
      return top ? (top.pct ?? top.amount ?? null) : null;
    }
    default:
      return null;
  }
}

/**
 * The draft as the storefront would receive it, for the preview — the real `DealCard` with the editor's own words.
 * Figures come from the saved benefit; a benefit type the stub has no form for shows its summary as a word.
 */
export function previewDeal(item: Schemas["PromotionDto"], display: DisplayDraft, locale: "th" | "en"): Deal {
  const benefit = item.benefit;
  // Every other benefit (special unit price, free design / mock-up / revision rounds, bonus points) is a perk.
  const kind = BENEFIT_KIND[benefit.type] ?? "perk";
  const words = (entry: Localized | null) => (entry ? entry[locale] || entry.th : "");
  return {
    id: item.id,
    slug: display.slug || "slug",
    featured: display.featured,
    headline: words(display.headline) || item.name,
    subline: words(display.subline) || null,
    badge: display.badge ? words(display.badge) || null : null,
    benefit: {
      kind,
      value: previewValue(benefit, kind),
      maxDiscount: benefit.maxAmount ?? null,
      summary: locale === "en" ? item.benefitSummaryEn : item.benefitSummaryTh,
    },
    conditions: [],
    productTypeCodes: item.conditions.productTypeCodes ?? [],
    code: item.kind === "coupon" ? "CODE" : null,
    startsAt: item.startsAt,
    endsAt: item.endsAt ?? null,
    endingSoon: false,
    terms: words(display.terms) || null,
    heroImageUrl: item.heroImageUrl ?? null,
    myStatus: null,
    notEligibleReason: null,
    shareUrl: `https://getpack.co/deals/${display.slug || "slug"}`,
  };
}
