import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  getBanners,
  getCatalogueTree,
  getConfigurator,
  getPriceHints,
  getSupportChannels,
  listArticles,
  listProducts,
  listShowcase,
  listStockProducts,
  type SupportChannels,
} from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref, productHref } from "@/features/customer/catalog/paths";
import { ProductGrid } from "@/features/customer/catalog/ProductGrid";
import {
  ArrowLink,
  CategoryTicker,
  CategoryTiles,
  HOME_WRAP,
  HowItWorks,
  WhyPackio,
} from "@/features/customer/home/EditorialSections";
import { HomeHero } from "@/features/customer/home/HomeHero";
import { HomeStudio } from "@/features/customer/home/HomeStudio";
import { NewsletterForm } from "@/features/customer/home/NewsletterForm";
import { getGuarantee, listReviews } from "@/features/customer/trust/api.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { KraftPanel } from "@/ui/components/Decor";
import { ProductCard } from "@/ui/components/ProductCard";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The storefront home, in the order of the 2026-10-06 redesign (F3 page patterns, D-180, D-181):
 * hero with the quick quote · how ordering works · product types · ready-to-ship stock · the
 * online studio · why Packio · work and verified reviews · articles · newsletter and contact.
 * Every figure on it comes from the API (starting prices with what they assume, MOQ, lead times,
 * the claim window, support hours); a section with nothing real to show shows its honest empty
 * variant or nothing — never an invented quote, review count or statistic.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tree, heroBanners, products, stock, showcase, reviews, articles, guarantee, channels, format] =
    await Promise.all([
      getTranslations("home"),
      getCatalogueTree(),
      getBanners("home_hero"),
      listProducts({ perPage: 48 }).catch(() => ({ data: [], meta: { page: 1, perPage: 48, total: 0 } })),
      listStockProducts({ perPage: 4 }).catch(() => ({ data: [], meta: { page: 1, perPage: 4, total: 0 } })),
      listShowcase({ perPage: 4 }).catch(() => null),
      listReviews().catch(() => ({ reviews: [], total: 0 })),
      listArticles({ perPage: 3 }).catch(() => null),
      getGuarantee().catch(() => null),
      getSupportChannels(),
      getFormat(),
    ]);
  const types = tree.flatMap((category) => category.types);
  // Instant-price categories lead the tiles, as they lead the catalogue (UX audit step 4).
  const orderedCategories = [...tree].sort(
    (a, b) =>
      Number(b.types.some((type) => type.availability !== "rfq")) -
      Number(a.types.some((type) => type.availability !== "rfq")),
  );
  // The hero's figures: the catalogue's categories and the shortest lead time any type states.
  const leadTimes = types.map((type) => type.leadTimeDays?.min).filter((days): days is number => days !== undefined);
  const heroFacts = { categories: tree.length, fastestDays: leadTimes.length ? Math.min(...leadTimes) : null };
  const priced = new Set(types.filter((type) => type.availability !== "rfq").map((type) => type.code));
  const quickStart = products.data
    .filter((product) => priced.has(product.productTypeCode))
    .slice(0, 24)
    .map((product) => ({ slug: product.slug, name: pick(locale, product.nameTh, product.nameEn) }));
  const [stockHints, firstConfigurator] = await Promise.all([
    getPriceHints({ skus: stock.data.map((product) => product.sku) }),
    // How long a saved price holds — the configurator's own figure, under the quick-quote slip.
    quickStart[0] ? getConfigurator(quickStart[0].slug).catch(() => null) : Promise.resolve(null),
  ]);
  const validityDays = firstConfigurator?.quoteValidityDays ?? null;
  const work = showcase?.data ?? [];
  const quotes = reviews.reviews.filter((review) => review.comment).slice(0, 3);
  // Special work goes to the RFQ form of a category the catalogue quotes by hand, when it has one.
  const rfqTypes = types.filter((type) => type.availability === "rfq");
  const rfqCategory = rfqTypes[0]?.categoryCode ?? null;

  return (
    <>
      {/* 1 · Hero, its figures and the quick-quote slip (the "Main" board, design language v2). */}
      <HomeHero banner={heroBanners[0]} products={quickStart} facts={heroFacts} validityDays={validityDays} />

      {/* 2 · The categories, sliding. */}
      <CategoryTicker names={tree.map((category) => pick(locale, category.nameTh, category.nameEn))} />

      {/* 3 · How ordering works, four numbered steps. */}
      <HowItWorks />

      {/* 4 · The categories as editorial tiles, instant-price first. */}
      <CategoryTiles
        categories={orderedCategories}
        locale={locale}
        total={tree.length}
        rfqHref={rfqCategory ? `/rfq/${encodeURIComponent(rfqCategory)}` : null}
      />

      {/* 5 · Ready to ship. */}
      {stock.data.length > 0 ? (
        <section aria-labelledby="home-stock" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{t("stock.eyebrow")}</p>
              <h2 id="home-stock" className="mt-3.5 text-4xl leading-[1.12] md:text-5xl">
                {t("sections.stock")}
              </h2>
              <p className="text-muted mt-3 text-[17px]">{t("sections.stockSub")}</p>
            </div>
            <ArrowLink href="/products">{t("sections.viewAll")}</ArrowLink>
          </div>
          <ProductGrid
            items={stock.data.map((product) => ({ kind: "stock" as const, product }))}
            types={new Map()}
            hints={stockHints}
            eager={0}
            stockAspect="square"
          />
        </section>
      ) : null}

      {/* 6 · The online studio, on a deep-green band. */}
      <HomeStudio />

      {/* 7 · Why Packio: a statement and three proof points, figures from the API. */}
      <WhyPackio claimWindowDays={guarantee?.claimWindowDays ?? null} />

      {/* 8 · Work and words from real customers — or the honest kraft band that says they are coming. */}
      {work.length === 0 && quotes.length === 0 ? (
        <section aria-labelledby="home-work" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
          <KraftPanel className="grain grid items-center gap-8 rounded-[1.75rem] p-8 md:grid-cols-[1.3fr_auto] md:p-14">
            <div className="relative">
              <p className="eyebrow">{t("work.eyebrow")}</p>
              <h2 id="home-work" className="mt-3 text-3xl leading-tight md:text-4xl">
                {t("work.emptyTitle")}
              </h2>
              <p className="text-fg/80 mt-3 max-w-[34em] text-lg">{t("work.emptyBody")}</p>
            </div>
            <div className="relative">
              <Button asChild size="lg" shape="pill">
                <Link href="/styles">{t("work.emptyAction")}</Link>
              </Button>
            </div>
          </KraftPanel>
        </section>
      ) : (
        <section aria-labelledby="home-work" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{t("work.eyebrow")}</p>
              <h2 id="home-work" className="mt-3.5 text-4xl leading-[1.12] md:text-5xl">
                {t("work.heading")}
              </h2>
            </div>
            {quotes.length ? <ArrowLink href="/reviews">{t("work.allReviews")}</ArrowLink> : null}
          </div>
          <div className="flex flex-col gap-6">
            {work.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
                {work.map((item) => {
                  const name = pick(locale, item.nameTh, item.nameEn);
                  const src = storeImageSrc(item.imageUrl);
                  return (
                    <ProductCard
                      key={item.slug}
                      as="li"
                      title={<Link href={productHref(item.productSlug)}>{name}</Link>}
                      image={src ? { src, alt: name } : null}
                      meta={item.descriptionTh}
                    />
                  );
                })}
              </ul>
            ) : null}
            {quotes.length > 0 ? (
              <ul className="grid gap-5 md:grid-cols-3">
                {quotes.map((review) => (
                  <Card as="li" key={review.id} padding="lg">
                    <figure>
                      <blockquote className="serif text-xl leading-snug font-medium">
                        <q>{review.comment}</q>
                      </blockquote>
                      <figcaption className="text-muted mt-3 text-xs">
                        {t("work.reviewBy", {
                          name: review.reviewerName,
                          type: pick(locale, review.productTypeNameTh, review.productTypeNameEn),
                          rating: review.rating,
                        })}
                      </figcaption>
                    </figure>
                  </Card>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      )}

      {/* 9 · Articles. */}
      {articles && articles.data.length > 0 ? (
        <section aria-labelledby="home-articles" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{t("sections.articlesKicker")}</p>
              <h2 id="home-articles" className="mt-3.5 text-4xl leading-[1.12] md:text-5xl">
                {t("sections.articles")}
              </h2>
            </div>
            <ArrowLink href="/articles">{t("sections.viewAll")}</ArrowLink>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {articles.data.map((article) => {
              const name = pick(locale, article.titleTh, article.titleEn);
              const src = storeImageSrc(article.coverUrl);
              return (
                <ProductCard
                  key={article.slug}
                  as="li"
                  title={<Link href={articleHref(article.slug)}>{name}</Link>}
                  image={src ? { src, alt: "" } : null}
                  fallback={{ icon: "article", tone: "paper" }}
                  eyebrow={format.date(article.publishedAt)}
                  meta={article.excerptTh}
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* 10 · Newsletter and how to reach us, light, under a rule (the footer follows). */}
      <section aria-labelledby="home-closing" className={cn(HOME_WRAP, "pt-20 pb-24 md:pt-24")}>
        <div className="border-fg grid items-start gap-12 border-t pt-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="home-closing" className="text-3xl leading-tight md:text-4xl">
              {t.rich("newsletter.headingEditorial", { br: () => <br /> })}
            </h2>
            <NewsletterForm />
          </div>
          <ContactPanel channels={channels} rfqCategory={rfqCategory} />
        </div>
      </section>
    </>
  );
}

/** The closing band's right half: support hours and channels from the API, and two ways to talk. */
async function ContactPanel({
  channels,
  rfqCategory,
}: {
  channels: SupportChannels | null;
  rfqCategory: string | null;
}) {
  const t = await getTranslations("home.contact");
  const rows = [
    { key: "phone", value: channels?.phone, href: channels?.phone ? `tel:${channels.phone}` : null },
    { key: "line", value: channels?.lineOaId, href: null },
    { key: "email", value: channels?.email, href: channels?.email ? `mailto:${channels.email}` : null },
  ] as const;

  return (
    <div className="border-border bg-surface rounded-card relative flex flex-col border p-7">
      <h3 className="serif text-2xl">{t("bandTitle")}</h3>
      {channels?.hours ? (
        <p className="text-muted mt-2.5 flex items-center gap-2 text-sm">
          <Icon name="clock" size={16} />
          {t("hoursLine", { hours: channels.hours })}
        </p>
      ) : null}
      <dl className="text-muted mt-3 grid gap-1 text-sm">
        {rows.map((row) =>
          row.value ? (
            <div key={row.key} className="flex gap-2">
              <dt>{t(row.key)}</dt>
              <dd>
                {row.href ? (
                  <a href={row.href} className="text-primary underline underline-offset-4">
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      <div className="mt-6 flex flex-col gap-2.5">
        <Button asChild size="lg" shape="pill" iconStart="chat">
          <Link href="/help/chat">{t("chat")}</Link>
        </Button>
        {rfqCategory ? (
          <Button asChild size="lg" shape="pill" variant="secondary">
            <Link href={`/rfq/${encodeURIComponent(rfqCategory)}`}>{t("rfq")}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
