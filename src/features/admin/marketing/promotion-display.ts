/**
 * Loyalty P1.5: what the promotion editor's "การแสดงผล" tab edits and the rules it shows before publishing — the API's
 * publish guard (API-CHANGES-P15 Admin), mirrored so the button says why it waits. The API still decides.
 * CONTRACT-REQUEST admin.promotions.display.
 */

import {
  promotionPublicFields,
  type PromotionDisplay,
  type PromotionVisibility,
} from "@/lib/api/requests/admin-promotions";
import type { Deal } from "@/lib/api/requests/store-deals";
import type { Schemas } from "@/lib/api/types";

export const EMPTY_DISPLAY: PromotionDisplay = {
  headline: { th: "", en: "" },
  subline: { th: "", en: "" },
  badge: null,
  terms: { th: "", en: "" },
  heroImageKey: null,
  featured: false,
  slug: "",
};

/** The fields the published `PromotionDto` carries from P1.5 on; an older API sends none (hidden, no copy). */
export function publicFieldsOf(item: unknown): {
  visibility: PromotionVisibility;
  display: PromotionDisplay;
  heroImageUrl: string | null;
} {
  const parsed = promotionPublicFields.partial().safeParse(item);
  const fields = parsed.success ? parsed.data : {};
  return {
    visibility: fields.visibility ?? "hidden",
    display: fields.display ?? EMPTY_DISPLAY,
    heroImageUrl: fields.heroImageUrl ?? null,
  };
}

/** Words a public deal may not use (D-481, GLOBAL-RULES §1–§2) — the API refuses them too. */
export const BLOCKED_WORDS = /โรงงาน|factory|กำไร|margin|ทันที|นับถอยหลัง|countdown|flash\s*sale/i;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublishCheck = "active" | "slug" | "headline" | "terms" | "words";

/** Each guard condition and whether it holds, in the order the panel lists them. */
export function publishChecks(
  status: Schemas["PromotionStatus"],
  display: PromotionDisplay,
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

const BENEFIT_KIND: Partial<Record<Schemas["PromotionBenefitType"], Deal["benefit"]["kind"]>> = {
  percent: "percent",
  fixed: "amount",
  free_shipping: "free_shipping",
  points_multiplier: "points_multiplier",
};

/**
 * The draft as the storefront would receive it, for the preview — the real `DealCard` with the editor's own words.
 * Figures come from the saved benefit; a benefit type the stub has no form for shows its summary as a word.
 */
export function previewDeal(item: Schemas["PromotionDto"], display: PromotionDisplay, locale: "th" | "en"): Deal {
  const benefit = item.benefit;
  const kind = BENEFIT_KIND[benefit.type] ?? "percent";
  const value =
    kind === "percent"
      ? (benefit.pct ?? "0")
      : kind === "amount"
        ? (benefit.amount ?? "0.00")
        : kind === "points_multiplier"
          ? (benefit.multiplier ?? "1")
          : "";
  const words = (entry: { th: string; en: string } | null) => (entry ? entry[locale] || entry.th : "");
  return {
    id: item.id,
    slug: display.slug || "slug",
    featured: display.featured,
    headline: words(display.headline) || item.name,
    subline: words(display.subline) || null,
    badge: display.badge ? words(display.badge) || null : null,
    benefit: {
      kind,
      value,
      maxDiscount: benefit.maxAmount ?? null,
      summary: locale === "en" ? item.benefitSummaryEn : item.benefitSummaryTh,
    },
    conditions: [],
    productTypeCodes: item.conditions.productTypeCodes ?? [],
    code: item.kind === "coupon" ? "CODE" : null,
    startsAt: item.startsAt,
    endsAt: item.endsAt ?? null,
    endingSoon: false,
    terms: words(display.terms),
    heroImageUrl: null,
    myStatus: null,
    notEligibleReason: null,
    shareUrl: `https://getpack.co/deals/${display.slug || "slug"}`,
  };
}
