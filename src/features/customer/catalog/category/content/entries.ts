import type { CategoryContent } from "./schema";

/**
 * Category content for business review (category redesign Phase 1 item 2). Every entry is `draft`: nothing below
 * renders until the business approves it (sets `status: "approved"`, `reviewedBy`, `reviewedOn`) — the page hides
 * the element instead (GLOBAL-RULES §3). Drafts are written only from repo/API facts (DECISIONS-STAGE-A §4, D-220,
 * the configurator's custom-size step) and their words sit in `catalog.categoryContent.<code>` (th, en).
 * Categories without an entry have no content yet.
 */
export const CATEGORY_CONTENT: readonly CategoryContent[] = [
  {
    categoryCode: "corrugated",
    intro: { status: "draft" },
    faq: { status: "draft", keys: ["customSize", "vat", "fit"] },
  },
  { categoryCode: "folding_carton" },
  { categoryCode: "label_sticker" },
  { categoryCode: "tag_sleeve" },
  { categoryCode: "flexible_pouch" },
  { categoryCode: "standard_product" },
  { categoryCode: "rigid_box" },
  { categoryCode: "paper_bag" },
  { categoryCode: "food_packaging" },
  { categoryCode: "tube" },
  { categoryCode: "custom_tape" },
  { categoryCode: "pop_display" },
  { categoryCode: "other" },
  { categoryCode: "service" },
];
