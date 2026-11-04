import type { Deal } from "@/features/shared/deals/types";

/** A deal's own page (`/deals/[slug]`). */
export const dealHref = (deal: Pick<Deal, "slug">) => `/deals/${encodeURIComponent(deal.slug)}`;

export const DEALS_HREF = "/deals";
