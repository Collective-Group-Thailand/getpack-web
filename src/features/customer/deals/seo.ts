import type { Locale } from "@/i18n/routing";
import type { Deal } from "@/lib/api/requests/store-deals";
import { alternateUrls, itemListSchema, offerSchema } from "@/lib/seo";

import { dealHref } from "./paths";

/** A deal as `Offer` structured data (PLAN §3.5.3): its own words, dates and URL — no price, no rating. */
export function dealOfferSchema(deal: Deal, origin: string, locale: Locale, typeNames: Record<string, string>) {
  return offerSchema({
    name: deal.headline,
    description: [deal.benefit.summary, deal.subline].filter(Boolean).join(" · "),
    url: alternateUrls(origin, dealHref(deal), locale).canonical,
    validFrom: deal.startsAt,
    validThrough: deal.endsAt,
    category: deal.productTypeCodes.map((code) => typeNames[code]).filter((name): name is string => Boolean(name)),
  });
}

/** `/deals` as the list of its deal pages, in the order shown. */
export function dealsListSchema(deals: readonly Deal[], origin: string, locale: Locale, name: string) {
  return itemListSchema(
    deals.map((deal) => ({
      name: deal.headline,
      url: alternateUrls(origin, dealHref(deal), locale).canonical,
      description: deal.benefit.summary,
    })),
    name,
  );
}
