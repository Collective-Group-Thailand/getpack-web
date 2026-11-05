import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { getLoyaltySurfaces } from "@/features/customer/loyalty/surfaces.server";
import { FeatureUnavailable, UNAVAILABLE_ROBOTS } from "@/features/customer/shell/FeatureUnavailable";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { readNow } from "@/features/customer/deals/now.server";
import { dealRef, getApplicableCodes, listDeals } from "@/features/customer/deals/api.server";
import { DealsGuide, dealsFaq } from "@/features/customer/deals/DealsGuide";
import { DealsHeader, DealTabs } from "@/features/customer/deals/DealsHeader";
import { DealsView, FeaturedDeal } from "@/features/customer/deals/DealsView";
import { dealsListSchema } from "@/features/customer/deals/seo";
import { TypeSelect } from "@/features/customer/deals/TypeSelect";
import { featuredDeal } from "@/features/shared/deals/model";
import { getRewardsOrNull } from "@/features/customer/rewards/api.server";
import { RewardsTab } from "@/features/customer/rewards/RewardsTab";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { DEAL_TABS, type DealTab } from "@/features/shared/deals/types";
import { alternateUrls, faqPageSchema, publicOrigin } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

type SearchParams = Promise<{ tab?: string | string[]; type?: string | string[]; ref?: string | string[] }>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
const tabOf = (value: string | undefined): DealTab =>
  DEAL_TABS.includes(value as DealTab) ? (value as DealTab) : "all";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [t, locale, origin, raw, surfaces] = await Promise.all([
    getTranslations("deals"),
    getLocale(),
    publicOrigin(),
    searchParams,
    getLoyaltySurfaces(),
  ]);
  // Loyalty P4 (D-509): a closed surface is a calm page kept out of search results.
  if (!surfaces.deals || (one(raw.tab) === "points" && !surfaces.redeem))
    return { title: t("title"), robots: UNAVAILABLE_ROBOTS };
  const { canonical, languages } = alternateUrls(origin, "/deals", locale as Locale);
  // A tab, a type or a share link's `?ref=` is a view of the list, not a page of its own.
  const filtered = Boolean(one(raw.tab) || one(raw.type) || one(raw.ref));
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical, languages },
    openGraph: { title: t("title"), description: t("description"), url: canonical },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * `/deals` (loyalty P1.5, PLAN §3.5.3; prototype `p15-deals.html`): the header with the count and the time of the
 * read, the signed-in wallet strip, the featured ticket, the views as underline tabs with a product-type filter,
 * the deals (a grid of tickets from 768 px, compact rows below), and how coupons work beside the FAQ. Indexable, with
 * `ItemList` and `FAQPage` markup built from exactly what is on the page. A share link's `?ref=` is forwarded.
 */
export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;
  const tab = tabOf(one(raw.tab));
  const type = one(raw.type) ?? null;
  const [t, jar, ref, origin, typeNames] = await Promise.all([
    getTranslations("deals"),
    cookies(),
    dealRef(raw.ref),
    publicOrigin(),
    getProductTypeNames(locale).catch(() => ({}) as Record<string, string>),
  ]);
  const signedIn = Boolean(readAccessToken(jar));
  // Loyalty P4 (D-509, D-510): deals closed for this visitor, or the points tab with redeeming closed.
  const surfaces = await getLoyaltySurfaces();
  if (!surfaces.deals || (tab === "points" && !surfaces.redeem)) return <FeatureUnavailable signedIn={signedIn} />;
  const [list, everything, applicable, rewards] = await Promise.all([
    listDeals({ tab, productTypeCode: type ?? undefined, ref }),
    // The type filter's options and the header's count are over every deal, whatever the view.
    tab === "all" && !type ? Promise.resolve(null) : listDeals({ ref }),
    signedIn ? getApplicableCodes() : Promise.resolve(null),
    // Loyalty P3: "แลกด้วยแต้ม" is the reward catalogue (`store.rewards.list`, WEB-P3-NOTES §3).
    tab === "points" ? getRewardsOrNull() : Promise.resolve(null),
  ]);
  const all = everything ?? list;
  const now = await readNow();
  const updatedAt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const maxCodes = applicable?.maxCodes ?? null;
  const faq = await dealsFaq(maxCodes);

  const items = list?.items ?? [];
  const featured = tab === "all" && !type ? featuredDeal(items) : null;
  const rest = featured ? items.filter((deal) => deal.id !== featured.id) : items;
  const types = [...new Set((all?.items ?? []).flatMap((deal) => deal.productTypeCodes))]
    .filter((code) => typeNames[code])
    .map((code) => ({ code, name: typeNames[code]! }));
  const typeOf = (codes: readonly string[]) => (codes[0] ? (typeNames[codes[0]] ?? null) : null);

  return (
    <div className="max-w-content mx-auto px-4 pb-4 md:px-5">
      {items.length > 0 ? <JsonLd data={dealsListSchema(items, origin, locale as Locale, t("title"))} /> : null}
      <JsonLd data={faqPageSchema(faq)} />
      <DealsHeader
        count={all?.counts.all ?? 0}
        updatedAt={updatedAt}
        mine={
          signedIn && all
            ? {
                saved: all.items.filter((deal) => deal.myStatus === "saved").length,
                usable: applicable ? applicable.applicable.length : null,
              }
            : null
        }
      />

      {featured ? (
        <div className="mt-4 md:mt-6">
          <FeaturedDeal
            deal={featured}
            signedIn={signedIn}
            now={now}
            typeName={typeOf(featured.productTypeCodes)}
            typeNames={typeNames}
          />
        </div>
      ) : null}

      {list ? (
        <>
          <div className="md:border-border mt-8 flex flex-col gap-3 md:mt-10 md:flex-row md:items-end md:justify-between md:gap-5 md:border-b">
            <DealTabs current={tab} counts={list.counts} signedIn={signedIn} type={type} />
            {types.length > 1 && tab !== "points" ? (
              <div className="md:pb-2.5">
                <TypeSelect value={type ?? ""} options={types} tab={tab === "all" ? null : tab} />
              </div>
            ) : null}
          </div>
          {tab === "points" && rewards && rewards.items.length > 0 ? (
            <RewardsTab list={rewards} signedIn={signedIn} />
          ) : null}
          {/* Loyalty P2: a guest's "สำหรับคุณ" is the new-customer deals, under an invitation to sign in. */}
          {tab === "for_you" && !signedIn ? (
            <section
              aria-labelledby="for-you-sign-in"
              className="border-border bg-surface rounded-card mt-4 grid items-center gap-4 border px-5 py-[1.125rem] md:mt-6 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <h2 id="for-you-sign-in" className="text-base font-semibold">
                  {t("forYou.signInTitle")}
                </h2>
                <p className="text-muted mt-0.5 text-sm">{t("forYou.signInBody")}</p>
              </div>
              <Button asChild>
                <Link href="/sign-in?next=/deals?tab=for_you">{t("forYou.signIn")}</Link>
              </Button>
            </section>
          ) : null}
          {tab === "for_you" && signedIn ? <p className="text-muted mt-4 text-sm">{t("forYou.lede")}</p> : null}
          {tab === "points" && rewards && rewards.items.length > 0 ? null : rest.length > 0 ? (
            <DealsView
              className="mt-4 md:mt-6"
              deals={rest}
              signedIn={signedIn}
              now={now}
              typeNames={typeNames}
              showReasons={tab === "for_you"}
            />
          ) : featured ? null : tab === "for_you" ? (
            <EmptyState
              className="mt-6"
              icon="ticket"
              title={t("forYou.emptyTitle")}
              description={t("forYou.emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <Link href="/deals">{t("empty.all")}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              className="mt-6"
              icon="ticket"
              title={tab === "all" && !type ? t("empty.noneTitle") : t("empty.title")}
              description={tab === "all" && !type ? t("empty.noneBody") : t("empty.body")}
              action={
                <Button asChild variant="secondary">
                  <Link href={tab === "all" && !type ? "/products" : "/deals"}>
                    {tab === "all" && !type ? t("empty.products") : t("empty.all")}
                  </Link>
                </Button>
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          className="mt-8"
          icon="ticket"
          title={t("empty.noneTitle")}
          description={t("empty.noneBody")}
          action={
            <Button asChild variant="secondary">
              <Link href="/products">{t("empty.products")}</Link>
            </Button>
          }
        />
      )}

      <DealsGuide faq={faq} maxCodes={maxCodes} />
    </div>
  );
}
