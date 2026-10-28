/**
 * The per-category content of `/products/[category]` (category redesign PLAN.md §4): structure and mappings in
 * `entries.ts`, the words in i18n (`catalog.categoryContent.<code>.*`, th + en). Prices, MOQ, lead times, counts
 * and sizes never live here — they are the API's. Nothing renders unless its entry is `approved` by the business
 * (GLOBAL-RULES §3: no sample data); a `draft` is a proposal for review, written only from repo/API facts.
 */

export type ReviewStatus = "draft" | "approved";

export interface Reviewed {
  status: ReviewStatus;
  /** Who approved it (name or role) and when (ISO date) — required to be shown. */
  reviewedBy?: string;
  reviewedOn?: string;
}

export interface UseCase {
  id: string;
  /** Catalogue product slugs (or stock SKUs) this use case lists; unknown ones are dropped, counts are live. */
  keys: string[];
}

export interface CategoryContent {
  /** The API's category code, e.g. "corrugated". */
  categoryCode: string;
  /** `catalog.categoryContent.<code>.intro`. */
  intro?: Reviewed;
  /** Labels `catalog.categoryContent.<code>.useCases.<id>`. */
  useCases?: Reviewed & { items: UseCase[] };
  /** Per product: a short description (`…products.<slug>.short`) and its surface (`…products.<slug>.surface`). */
  products?: Record<string, Reviewed & { short?: boolean; surface?: boolean }>;
  /** Which product's standard sizes drive the finder (default: the first instant box product with sizes). */
  sizeFinder?: Reviewed & { productSlug: string };
  /** A material guide's words for a non-corrugated category (`…guide.title`, `…guide.items.<code>`). */
  guide?: Reviewed & { materialCodes: string[] };
  /** The style-library category this one maps to when the codes differ (open question Q6). */
  styles?: Reviewed & { styleCategory: string };
  /** Questions `…faq.<key>.q` / `.a`. */
  faq?: Reviewed & { keys: string[] };
}

/** Whether an entry may be shown: approved, with its reviewer named. */
export const approved = (entry: Reviewed | undefined): boolean =>
  entry?.status === "approved" && Boolean(entry.reviewedBy && entry.reviewedOn);
