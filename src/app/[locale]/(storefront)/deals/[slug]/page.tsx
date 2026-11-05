import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { getLoyaltySurfaces } from "@/features/customer/loyalty/surfaces.server";
import { FeatureUnavailable, UNAVAILABLE_ROBOTS } from "@/features/customer/shell/FeatureUnavailable";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { readNow } from "@/features/customer/deals/now.server";
import { dealRef, getDeal, listDeals } from "@/features/customer/deals/api.server";
import { DealsView, FeaturedDeal } from "@/features/customer/deals/DealsView";
import { dealHref } from "@/features/customer/deals/paths";
import { dealOfferSchema } from "@/features/customer/deals/seo";
import { ShareLink } from "@/features/customer/deals/ShareLink";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { alternateUrls, faqPageSchema, publicOrigin } from "@/lib/seo";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Icon } from "@/ui/icons";

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<{ ref?: string | string[] }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ slug }, raw, locale, origin] = await Promise.all([params, searchParams, getLocale(), publicOrigin()]);
  // Loyalty P4 (D-509): a closed surface stays out of search results.
  if (!(await getLoyaltySurfaces()).deals) return { robots: UNAVAILABLE_ROBOTS };
  const deal = await getDeal(slug, await dealRef(raw.ref)).catch(() => null);
  if (!deal) return {};
  const { canonical, languages } = alternateUrls(origin, dealHref(deal), locale as Locale);
  const description = [deal.benefit.summary, deal.subline].filter(Boolean).join(" · ");
  return {
    title: deal.headline,
    description,
    // The share link with `?ref=` is the same page: one canonical, without it.
    alternates: { canonical, languages },
    openGraph: {
      title: deal.headline,
      description,
      url: canonical,
      ...(deal.heroImageUrl ? { images: [deal.heroImageUrl] } : {}),
    },
  };
}

/**
 * `/deals/[slug]` (loyalty P1.5): one deal for its share link — the ticket, its main conditions and terms, the share
 * link, the FAQ the API builds for it, and a few other deals. `Offer` and `FAQPage` markup from exactly this content;
 * a hidden or ended deal is a 404 (the API's).
 */
export default async function DealPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;
  // Loyalty P4 (D-509, D-510): deals closed for this visitor.
  if (!(await getLoyaltySurfaces()).deals)
    return <FeatureUnavailable signedIn={Boolean(readAccessToken(await cookies()))} />;
  const ref = await dealRef(raw.ref);
  const [t, format, jar, origin, typeNames, deal] = await Promise.all([
    getTranslations("deals.detail"),
    getFormat(),
    cookies(),
    publicOrigin(),
    getProductTypeNames(locale).catch(() => ({}) as Record<string, string>),
    getDeal(slug, ref),
  ]);
  if (!deal) notFound();
  const signedIn = Boolean(readAccessToken(jar));
  const others = ((await listDeals({ ref }))?.items ?? []).filter((entry) => entry.id !== deal.id).slice(0, 3);
  const now = await readNow();
  const period = deal.endsAt
    ? t("period", { from: format.date(deal.startsAt), to: format.date(deal.endsAt) })
    : t("periodOpen", { from: format.date(deal.startsAt) });
  const typeName = deal.productTypeCodes[0] ? (typeNames[deal.productTypeCodes[0]] ?? null) : null;

  return (
    <div className="max-w-content mx-auto px-4 pt-5 pb-4 md:px-5 md:pt-8">
      <JsonLd data={dealOfferSchema(deal, origin, locale as Locale, typeNames)} />
      {deal.faq.length > 0 ? (
        <JsonLd data={faqPageSchema(deal.faq.map((entry) => ({ question: entry.q, answer: entry.a })))} />
      ) : null}
      <Link
        href="/deals"
        className="text-muted hover:text-fg inline-flex min-h-11 items-center gap-1 text-sm font-medium"
      >
        <Icon name="chevron-left" size={16} aria-hidden="true" />
        {t("back")}
      </Link>

      <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-10">
        <div className="min-w-0">
          <FeaturedDeal
            deal={deal}
            signedIn={signedIn}
            now={now}
            typeName={typeName}
            typeNames={typeNames}
            headingLevel="h1"
          />
          <section aria-labelledby="deal-conditions" className="mt-8">
            <h2 id="deal-conditions" className="m-0 text-lg font-semibold">
              {t("conditions")}
            </h2>
            <dl className="border-border m-0 mt-3 border-t">
              {deal.conditions.map((entry) => (
                <div
                  key={entry.label}
                  className="border-border flex justify-between gap-6 border-b py-2.5 text-[0.9375rem]"
                >
                  <dt className="text-muted">{entry.label}</dt>
                  <dd className="m-0 text-end font-medium">{entry.value}</dd>
                </div>
              ))}
              <div className="border-border flex justify-between gap-6 border-b py-2.5 text-[0.9375rem]">
                <dt className="text-muted">{t("terms")}</dt>
                <dd className="m-0 text-end font-medium tabular-nums">{period}</dd>
              </div>
            </dl>
            <p className="text-muted m-0 mt-4 max-w-[68ch] text-[0.9375rem] leading-relaxed">{deal.terms}</p>
          </section>
        </div>
        <aside aria-labelledby="deal-share" className="lg:pt-1">
          <div className="border-border bg-surface rounded-card border p-5">
            <h2 id="deal-share" className="m-0 text-base font-semibold">
              {t("share")}
            </h2>
            <p className="text-muted m-0 mt-1 mb-3 text-sm">{t("shareHint")}</p>
            <ShareLink url={deal.shareUrl} title={deal.headline} />
          </div>
        </aside>
      </div>

      {deal.faq.length > 0 ? (
        <section aria-labelledby="deal-faq" className="border-border mt-12 border-t pt-8 lg:max-w-[66%]">
          <h2 id="deal-faq" className="m-0 text-[1.375rem] font-semibold">
            {t("faq")}
          </h2>
          <DisclosureList
            className="mt-4"
            headingLevel="h3"
            items={deal.faq.map((entry, index) => ({ summary: entry.q, content: entry.a, defaultOpen: index === 0 }))}
          />
        </section>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="deal-more" className="mt-14">
          <h2 id="deal-more" className="m-0 mb-5 text-[1.375rem] font-semibold">
            {t("more")}
          </h2>
          <DealsView deals={others} signedIn={signedIn} now={now} typeNames={typeNames} layout="strip" />
        </section>
      ) : null}
    </div>
  );
}
