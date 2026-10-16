import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { pick } from "@/features/customer/catalog/localize";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getReviewSummary, listReviews } from "@/features/customer/trust/api.server";
import { getFormat } from "@/features/shared/format/server";
import { organizationSchema, webPageSchema } from "@/lib/seo";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.trust.reviews");
  return { title: t("title"), description: t("intro") };
}

/**
 * Verified reviews (U2.F4, D-181): only reviews getpack-api ties to a delivered order, each with its
 * product type and date, and getpack's reply. With none yet, the page says so — never a placeholder
 * testimonial.
 */
export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, current, summary, list] = await Promise.all([
    getTranslations("storefront.trust.reviews"),
    getFormat(),
    getLocale(),
    getReviewSummary().catch(() => null),
    listReviews().catch(() => ({ reviews: [], total: 0 })),
  ]);

  const page = await pageContext("/reviews", t("title"));
  // An aggregate rating is claimed only when the API has verified reviews to back it (D-181):
  // the same rule as the Organization data, which carries no rating of its own.
  const rated = summary && summary.count > 0 && summary.averageRating;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={{
          ...webPageSchema({ name: t("title"), description: t("intro"), url: page.url, locale: page.language }),
          ...(rated
            ? {
                mainEntity: {
                  ...organizationSchema(page.origin),
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: summary.averageRating,
                    reviewCount: summary.count,
                    bestRating: 5,
                    worstRating: 1,
                  },
                },
              }
            : {}),
        }}
      />
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      {!summary || summary.count === 0 || list.reviews.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="star"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<NextStep to="products" />}
        />
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          <section aria-labelledby="reviews-summary" className="flex flex-col gap-3">
            <h2 id="reviews-summary" className="text-xl font-semibold">
              {summary.averageRating
                ? t("average", { rating: summary.averageRating, count: summary.count })
                : t("countOnly", { count: summary.count })}
            </h2>
            <ul className="flex flex-col gap-1">
              {[...summary.distribution]
                .sort((a, b) => b.rating - a.rating)
                .map((row) => (
                  <li key={row.rating} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-sm">
                    <span>{t("stars", { rating: row.rating })}</span>
                    {/* The bar's length only: the count beside it is the API's. */}
                    <Meter
                      value={Math.round((row.count / Math.max(summary.count, 1)) * 100)}
                      label={t("stars", { rating: row.rating })}
                      valueText={t("starsCount", { rating: row.rating, count: row.count })}
                    />
                    <span className="text-muted text-end tabular-nums">{format.number(row.count)}</span>
                  </li>
                ))}
            </ul>
          </section>
          <section aria-labelledby="reviews-list">
            <h2 id="reviews-list" className="sr-only">
              {t("listTitle")}
            </h2>
            <ul className="flex flex-col gap-4">
              {list.reviews.map((review) => (
                <li key={review.id} className="bg-surface border-border flex flex-col gap-2 rounded-xl border p-4">
                  <p className="text-sm font-medium">
                    {t("reviewHead", {
                      rating: review.rating,
                      name: review.reviewerName,
                      product: pick(current, review.productTypeNameTh, review.productTypeNameEn),
                      date: format.date(review.createdAt),
                    })}
                  </p>
                  {review.comment ? <p className="text-sm whitespace-pre-line">{review.comment}</p> : null}
                  {review.reply ? (
                    <div className="border-border bg-bg-subtle rounded-lg border-s-4 p-3 text-sm">
                      <p className="font-medium">{t("reply", { date: format.date(review.reply.repliedAt) })}</p>
                      <p className="whitespace-pre-line">{review.reply.body}</p>
                    </div>
                  ) : null}
                  <p className="text-muted text-xs">{t("verified")}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
