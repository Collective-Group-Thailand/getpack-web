import type { CategoryContent } from "./schema";

/**
 * Category content for business review (category redesign Phase 1 item 2). Every entry is `draft`: nothing below
 * renders until the business approves it (sets `status: "approved"`, `reviewedBy`, `reviewedOn`) — the page hides
 * the element instead (GLOBAL-RULES §3). Drafts are written only from repo/API facts (DECISIONS-STAGE-A §4, D-220,
 * the configurator's custom-size step) and their words sit in `catalog.categoryContent.<code>` (th, en).
 * Categories without an entry have no content yet.
 *
 * Approved so far (owner, C2b 2026-10-28 17:48, DECISIONS-STAGE-A §15.1): ONLY the three style-library mappings
 * below — the catalogue and the style library name these categories differently (Q6). Everything else stays draft.
 */
const OWNER_C2B = { status: "approved", reviewedBy: "Superball (product owner)", reviewedOn: "2026-10-28" } as const;
export const CATEGORY_CONTENT: readonly CategoryContent[] = [
  {
    categoryCode: "corrugated",
    intro: { status: "draft" },
    faq: { status: "draft", keys: ["customSize", "vat", "fit"] },
  },
  { categoryCode: "folding_carton" },
  { categoryCode: "label_sticker", styles: { ...OWNER_C2B, styleCategory: "label" } },
  { categoryCode: "tag_sleeve" },
  { categoryCode: "flexible_pouch", styles: { ...OWNER_C2B, styleCategory: "flexible" } },
  { categoryCode: "standard_product" },
  { categoryCode: "rigid_box", styles: { ...OWNER_C2B, styleCategory: "rigid" } },
  { categoryCode: "paper_bag" },
  { categoryCode: "food_packaging" },
  { categoryCode: "tube" },
  { categoryCode: "custom_tape" },
  { categoryCode: "pop_display" },
  { categoryCode: "other" },
  { categoryCode: "service" },
];
