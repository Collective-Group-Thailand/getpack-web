import type { Deal } from "@/lib/api/requests/store-deals";

/** A deal's own page (`/deals/[slug]`). */
export const dealHref = (deal: Pick<Deal, "slug">) => `/deals/${encodeURIComponent(deal.slug)}`;

export const DEALS_HREF = "/deals";
