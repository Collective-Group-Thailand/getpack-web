import type { CategoryContent } from "./schema";

/**
 * Category content for business review (category redesign Phase 1 item 2). Every entry is `draft`: nothing below
 * renders until the business approves it (sets `status: "approved"`, `reviewedBy`, `reviewedOn`) — the page hides
 * the element instead (GLOBAL-RULES §3). Drafts are written only from repo/API facts (DECISIONS-STAGE-A §4, D-220,
 * the configurator's custom-size step) and their words sit in `catalog.categoryContent.<code>` (th, en).
 * Categories without an entry have no content yet.
 *
 * Approved (owner, C2b 2026-10-28 17:48, DECISIONS-STAGE-A §15.1): the three style-library mappings below — the
 * catalogue and the style library name these categories differently (Q6).
 * Approved (C12 2026-10-29, DECISIONS-STAGE-A §17.3, D-460 — written and reviewed by the assistant as head of
 * Marketing, delegated by the owner): every category's intro and FAQ. The intro describes the category only; how it
 * is bought (instant / quote / mixed) still comes from the API facts (`CategoryHead` adds that line after it).
 * Use cases, per-product words, size-finder overrides and material guides stay empty (no approved data).
 */
const OWNER_C2B = { status: "approved", reviewedBy: "Superball (product owner)", reviewedOn: "2026-10-28" } as const;
const C12 = {
  status: "approved",
  reviewedBy: "Assistant as head of Marketing (delegated by Superball, product owner)",
  reviewedOn: "2026-10-29",
} as const;
const approvedCopy = (keys: string[]) => ({ intro: C12, faq: { ...C12, keys } });
export const CATEGORY_CONTENT: readonly CategoryContent[] = [
  { categoryCode: "corrugated", ...approvedCopy(["customSize", "fit", "moq", "vat"]) },
  { categoryCode: "folding_carton", ...approvedCopy(["moq", "vat"]) },
  { categoryCode: "label_sticker", ...approvedCopy(["moq", "vat"]), styles: { ...OWNER_C2B, styleCategory: "label" } },
  { categoryCode: "tag_sleeve", ...approvedCopy(["moq", "vat"]) },
  {
    categoryCode: "flexible_pouch",
    ...approvedCopy(["moq", "vat"]),
    styles: { ...OWNER_C2B, styleCategory: "flexible" },
  },
  { categoryCode: "standard_product", ...approvedCopy(["moq", "vat"]) },
  { categoryCode: "rigid_box", ...approvedCopy(["quote", "vat"]), styles: { ...OWNER_C2B, styleCategory: "rigid" } },
  { categoryCode: "paper_bag", ...approvedCopy(["quote", "vat"]) },
  { categoryCode: "food_packaging", ...approvedCopy(["quote", "foodContact", "vat"]) },
  { categoryCode: "tube", ...approvedCopy(["quote", "vat"]) },
  { categoryCode: "custom_tape", ...approvedCopy(["quote", "vat"]) },
  { categoryCode: "pop_display", ...approvedCopy(["quote", "vat"]) },
  { categoryCode: "other", ...approvedCopy(["quote", "vat"]) },
  { categoryCode: "service", intro: C12 },
];
