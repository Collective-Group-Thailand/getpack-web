import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  getBanners,
  getCatalogueTree,
  getPriceHints,
  getSupportChannels,
  listArticles,
  listProducts,
  listShowcase,
  listStockProducts,
  type Banner,
} from "@/features/customer/catalog/api.server";
import { cardFacts } from "@/features/customer/catalog/cardFacts";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref, productHref } from "@/features/customer/catalog/paths";
import { ProductGrid } from "@/features/customer/catalog/ProductGrid";
import { NewsletterForm } from "@/features/customer/home/NewsletterForm";
import { QuickStart } from "@/features/customer/home/QuickStart";
import { getGuarantee, listReviews } from "@/features/customer/trust/api.server";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { ProductCard } from "@/ui/components/ProductCard";
import { Icon } from "@/ui/icons";

/**
 * The storefront home in the eight sections of the F3 page patterns (U-F3, D-180, D-181), in order:
 * hero with the quick start · product types · how ordering works · ready-to-ship stock · why
 * Packio · work and verified reviews · articles · newsletter and contact. Every figure on it comes
 * from the API (starting prices with what they assume, MOQ, lead times, the claim window); a
 * section with nothing real to show shows its honest empty variant or nothing — never an invented
 * quote, review count or statistic.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon, tree, heroBanners, products, stock, showcase, reviews, articles, guarantee, channels, format] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("common"),
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
  const hero = heroBanners[0];
  const types = tree.flatMap((category) => category.types);
  const priced = new Set(types.filter((type) => type.availability !== "rfq").map((type) => type.code));
  const quickStart = products.data
    .filter((product) => priced.has(product.productTypeCode))
    .slice(0, 24)
    .map((product) => ({ slug: product.slug, name: pick(locale, product.nameTh, product.nameEn) }));
  // The lowest MOQ the catalogue states — a figure the API gives, not one invented for a slogan.
  const moqs = products.data.map((product) => product.moq).filter((moq): moq is number => moq !== null);
  const lowestMoq = moqs.length ? Math.min(...moqs) : null;
  const stockHints = await getPriceHints({ skus: stock.data.map((product) => product.sku) });
  const work = showcase?.data ?? [];
  const quotes = reviews.reviews.filter((review) => review.comment).slice(0, 3);

  const steps = (["design", "price", "proof", "track"] as const).map((key) => ({
    key,
    title: t(`process.${key}.title`),
    body: t(`process.${key}.body`),
  }));
  const benefits = [
    { key: "instant", icon: "calculator" as const, body: t("benefits.instant") },
    { key: "design", icon: "palette" as const, body: t("benefits.design") },
    {
      key: "moq",
      icon: "package" as const,
      body: lowestMoq !== null ? t("benefits.moqFrom", { quantity: format.number(lowestMoq) }) : t("benefits.moq"),
    },
    { key: "track", icon: "truck" as const, body: t("benefits.track") },
    { key: "tax", icon: "receipt" as const, body: t("benefits.tax") },
    {
      key: "claim",
      icon: "shield" as const,
      body: guarantee ? t("benefits.claimWithin", { days: guarantee.claimWindowDays }) : t("benefits.claim"),
    },
  ];

  const heading = (id: string, title: string, more?: { href: string; label: string }) => (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {more ? (
        <Link href={more.href} className="text-primary shrink-0 text-sm underline-offset-2 hover:underline">
          {more.label}
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      {/* 1 · Hero: one static picture (the LCP), two ways in, and the quick start. */}
      <section className="bg-bg-subtle">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:py-16">
          <div>
            <h1 className="text-display leading-tight font-bold">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>
            <p className="text-muted mt-4 max-w-md text-lg">{t("hero.body", { tagline: tCommon("brand.tagline") })}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/products">{t("hero.price")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/studio/new">{tCommon("nav.startDesigning")}</Link>
              </Button>
            </div>
            <QuickStart products={quickStart} />
          </div>
          {hero ? (
            <HeroBanner banner={hero} />
          ) : (
            <Card elevation="raised" padding="lg" className="aspect-[4/3] rounded-2xl">
              {/* The product, not a stock photo: a real dieline from @packio/dieline. */}
              <BoxPreview
                styleId="tuck-end"
                values={{ length: 70, width: 40, height: 110 }}
                label={t("hero.preview")}
              />
            </Card>
          )}
        </div>
      </section>

      {/* 2 · Product types, each with how it is priced and what its price assumes (D-307). */}
      {types.length > 0 ? (
        <section aria-labelledby="home-types" className="mx-auto max-w-6xl px-4 pt-16">
          {heading("home-types", t("sections.productTypes"), { href: "/products", label: t("sections.viewAll") })}
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {await Promise.all(
              types.map(async (type) => {
                const facts = await cardFacts(type);
                const name = pick(locale, type.nameTh, type.nameEn);
                return (
                  <ProductCard
                    key={type.code}
                    as="li"
                    className="w-60 shrink-0 snap-start md:w-auto"
                    title={<Link href={`/products?productType=${encodeURIComponent(type.code)}`}>{name}</Link>}
                    price={facts.price}
                    meta={facts.meta}
                    badges={facts.badges}
                  />
                );
              }),
            )}
          </ul>
        </section>
      ) : null}

      {/* 3 · How ordering works, four steps. */}
      <section aria-labelledby="home-process" className="bg-bg-subtle mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16">
          {heading("home-process", t("process.heading"), { href: "/learn", label: t("process.more") })}
          <ol className="grid gap-6 md:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.key}>
                <span
                  aria-hidden
                  className="bg-primary text-primary-fg mb-3 flex size-9 items-center justify-center rounded-full font-semibold"
                >
                  {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-muted mt-1 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Ready to ship. */}
      {stock.data.length > 0 ? (
        <section aria-labelledby="home-stock" className="mx-auto max-w-6xl px-4 pt-16">
          {heading("home-stock", t("sections.stock"), { href: "/products", label: t("sections.viewAll") })}
          <ProductGrid
            items={stock.data.map((product) => ({ kind: "stock" as const, product }))}
            types={new Map()}
            hints={stockHints}
            eager={0}
          />
        </section>
      ) : null}

      {/* 5 · Why Packio — six things the business can show, figures from the API. */}
      <section aria-labelledby="home-benefits" className="mx-auto max-w-6xl px-4 pt-16">
        {heading("home-benefits", t("benefits.heading"))}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <li key={benefit.key} className="border-border flex items-start gap-3 rounded-xl border p-4">
              <Icon name={benefit.icon} size={22} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-medium">{t(`benefits.${benefit.key}Title`)}</h3>
                <p className="text-muted mt-1 text-sm">{benefit.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 · Work and words from real customers — or the honest empty variant. */}
      <section aria-labelledby="home-work" className="mx-auto max-w-6xl px-4 pt-16">
        {heading(
          "home-work",
          t("work.heading"),
          quotes.length ? { href: "/reviews", label: t("work.allReviews") } : undefined,
        )}
        {work.length === 0 && quotes.length === 0 ? (
          <div className="border-border flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
            <p className="font-medium">{t("work.emptyTitle")}</p>
            <p className="text-muted text-sm">{t("work.emptyBody")}</p>
            <Button asChild variant="secondary">
              <Link href="/styles">{t("work.emptyAction")}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {work.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
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
              <ul className="grid gap-4 md:grid-cols-3">
                {quotes.map((review) => (
                  <li key={review.id} className="border-border rounded-xl border p-4">
                    <figure>
                      <blockquote className="text-sm">
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
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      {/* 7 · Articles. */}
      {articles && articles.data.length > 0 ? (
        <section aria-labelledby="home-articles" className="mx-auto max-w-6xl px-4 pt-16">
          {heading("home-articles", t("sections.articles"), { href: "/articles", label: t("sections.viewAll") })}
          <ul className="grid gap-4 md:grid-cols-3">
            {articles.data.map((article) => {
              const name = pick(locale, article.titleTh, article.titleEn);
              const src = storeImageSrc(article.coverUrl);
              return (
                <ProductCard
                  key={article.slug}
                  as="li"
                  title={<Link href={articleHref(article.slug)}>{name}</Link>}
                  image={src ? { src, alt: "" } : null}
                  eyebrow={format.date(article.publishedAt)}
                  meta={article.excerptTh}
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* 8 · Newsletter and how to reach us (the footer follows). */}
      <section aria-labelledby="home-closing" className="mx-auto mt-16 grid max-w-6xl gap-8 px-4 pb-16 md:grid-cols-2">
        <div>
          <h2 id="home-closing" className="text-2xl font-semibold">
            {t("newsletter.heading")}
          </h2>
          <p className="text-muted mt-2 text-sm">{t("newsletter.body")}</p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
        <div className="bg-bg-subtle rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{t("contact.heading")}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {channels?.hours ? (
              <div>
                <dt className="text-muted">{t("contact.hours")}</dt>
                <dd>{channels.hours}</dd>
              </div>
            ) : null}
            {channels?.phone ? (
              <div>
                <dt className="text-muted">{t("contact.phone")}</dt>
                <dd>
                  <a href={`tel:${channels.phone}`} className="underline underline-offset-4">
                    {channels.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {channels?.lineOaId ? (
              <div>
                <dt className="text-muted">{t("contact.line")}</dt>
                <dd>{channels.lineOaId}</dd>
              </div>
            ) : null}
            {channels?.email ? (
              <div>
                <dt className="text-muted">{t("contact.email")}</dt>
                <dd>
                  <a href={`mailto:${channels.email}`} className="underline underline-offset-4">
                    {channels.email}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <Button asChild variant="secondary" className="mt-4" iconStart="chat">
            <Link href="/help/chat">{t("contact.chat")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * A banner's target is an admin-entered path; only a path inside the site becomes a link, and
 * it is not prefetched — nothing guarantees the page exists, and a prefetch that 404s holds its
 * socket open (see `ComingSoon`).
 */
function bannerTarget(url: string | null): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return null;
  // Admins enter paths with a locale prefix ("/th/products/…"); the router adds the locale.
  return url.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
}

function HeroBanner({ banner }: { banner: Banner }) {
  const src = storeImageSrc(banner.desktopImageUrl);
  const target = bannerTarget(banner.targetUrl);
  if (!src) return null;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
    <img
      src={src}
      alt={banner.title}
      width={1200}
      height={900}
      fetchPriority="high"
      className="aspect-[4/3] w-full rounded-2xl object-cover"
    />
  );
  return target ? (
    <Link
      href={target}
      prefetch={false}
      className="focus-visible:ring-focus-ring block rounded-2xl outline-none focus-visible:ring-2"
    >
      {image}
    </Link>
  ) : (
    image
  );
}
