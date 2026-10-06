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
  type SupportChannels,
} from "@/features/customer/catalog/api.server";
import { cardFacts } from "@/features/customer/catalog/cardFacts";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref, productHref } from "@/features/customer/catalog/paths";
import { ProductGrid } from "@/features/customer/catalog/ProductGrid";
import { HomeHero } from "@/features/customer/home/HomeHero";
import { HomeStudio } from "@/features/customer/home/HomeStudio";
import { NewsletterForm } from "@/features/customer/home/NewsletterForm";
import { getGuarantee, listReviews } from "@/features/customer/trust/api.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { IconTile, KraftPanel } from "@/ui/components/Decor";
import { ProductCard } from "@/ui/components/ProductCard";
import { SectionHeading, sectionLinkClass } from "@/ui/components/SectionHeading";
import { Icon, type IconName } from "@/ui/icons";

/** The page column and the rhythm between sections (home redesign, 2026-10-06). */
const SECTION = "mx-auto max-w-[1180px] px-5 pt-16 md:px-8 md:pt-26";

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

  const [t, tCatalog, tree, heroBanners, products, stock, showcase, reviews, articles, guarantee, channels, format] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("catalog"),
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
  // Special work goes to the RFQ form of a category the catalogue quotes by hand, when it has one.
  const rfqTypes = types.filter((type) => type.availability === "rfq");
  const rfqCategory = rfqTypes[0]?.categoryCode ?? null;
  // Two rows at most: the priced types, then one card standing for everything quoted by hand.
  const shownTypes = types.filter((type) => type.availability !== "rfq").slice(0, rfqTypes.length ? 7 : 8);

  const steps: { key: "design" | "price" | "proof" | "track"; icon: IconName }[] = [
    { key: "design", icon: "upload" },
    { key: "price", icon: "calculator" },
    { key: "proof", icon: "file-check" },
    { key: "track", icon: "truck" },
  ];
  const benefits: { key: string; icon: IconName; body: string }[] = [
    { key: "design", icon: "palette", body: t("benefits.design") },
    {
      key: "moq",
      icon: "package",
      body: lowestMoq !== null ? t("benefits.moqFrom", { quantity: format.number(lowestMoq) }) : t("benefits.moq"),
    },
    { key: "track", icon: "truck", body: t("benefits.track") },
    { key: "tax", icon: "receipt", body: t("benefits.tax") },
    {
      key: "claim",
      icon: "shield",
      body: guarantee ? t("benefits.claimWithin", { days: guarantee.claimWindowDays }) : t("benefits.claim"),
    },
  ];

  const more = (href: string, label: string) => (
    <Link href={href} className={sectionLinkClass}>
      {label}
      <Icon name="arrow-right" size={16} />
    </Link>
  );

  return (
    <>
      {/* 1 · Hero and the quick quote overlapping it. */}
      <HomeHero banner={heroBanners[0]} products={quickStart} />

      {/* 2 · How ordering works, four steps. */}
      <section aria-labelledby="home-process" className={SECTION}>
        <SectionHeading
          id="home-process"
          kicker={t("process.kicker")}
          title={t("process.heading")}
          action={more("/learn", t("process.more"))}
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Card as="li" key={step.key} padding="lg" interactive>
              <div className="mb-4.5 flex items-center justify-between">
                <IconTile name={step.icon} tone="solid" />
                <span className="text-muted text-xs font-bold tracking-[0.06em]">
                  {t("process.step", { number: String(index + 1).padStart(2, "0") })}
                </span>
              </div>
              <h3 className="mb-1.5 text-lg font-bold">{t(`process.${step.key}.title`)}</h3>
              <p className="text-muted text-sm leading-relaxed">{t(`process.${step.key}.body`)}</p>
            </Card>
          ))}
        </ol>
      </section>

      {/* 3 · Product types, each with how it is priced and what its price assumes (D-307). */}
      {types.length > 0 ? (
        <section aria-labelledby="home-types" className={SECTION}>
          <SectionHeading
            id="home-types"
            kicker={t("sections.productTypesKicker")}
            title={t("sections.productTypes")}
            description={
              priced.size > 0 && priced.size < types.length
                ? t("sections.productTypesSub", { count: priced.size })
                : undefined
            }
            action={more("/products", t("sections.viewAllProducts"))}
          />
          <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-4">
            {await Promise.all(
              shownTypes.map(async (type, index) => {
                const facts = await cardFacts(type);
                const name = pick(locale, type.nameTh, type.nameEn);
                return (
                  <ProductCard
                    key={type.code}
                    as="li"
                    className="w-64 shrink-0 snap-start md:w-auto"
                    title={<Link href={`/products?productType=${encodeURIComponent(type.code)}`}>{name}</Link>}
                    fallback={{ icon: index % 2 ? "box" : "package", tone: index % 3 === 2 ? "paper" : "kraft" }}
                    eyebrow={<span className="flex flex-wrap gap-1">{facts.badges}</span>}
                    price={facts.price}
                    meta={facts.meta}
                  />
                );
              }),
            )}
            {rfqTypes.length > 0 ? (
              <ProductCard
                as="li"
                className="w-64 shrink-0 snap-start md:w-auto"
                title={<Link href="/products">{t("sections.specialTitle")}</Link>}
                fallback={{ icon: "document", tone: "primary" }}
                eyebrow={<Badge tone="info">{tCatalog("card.availability.rfq")}</Badge>}
                meta={t("sections.specialMeta", {
                  names: rfqTypes
                    .slice(0, 4)
                    .map((type) => pick(locale, type.nameTh, type.nameEn))
                    .join(" · "),
                })}
              />
            ) : null}
          </ul>
        </section>
      ) : null}

      {/* 4 · Ready to ship. */}
      {stock.data.length > 0 ? (
        <section aria-labelledby="home-stock" className={SECTION}>
          <SectionHeading
            id="home-stock"
            kicker={t("sections.stockKicker")}
            title={t("sections.stock")}
            description={t("sections.stockSub")}
            action={more("/products", t("sections.viewAll"))}
          />
          <ProductGrid
            items={stock.data.map((product) => ({ kind: "stock" as const, product }))}
            types={new Map()}
            hints={stockHints}
            eager={0}
            stockAspect="square"
          />
        </section>
      ) : null}

      {/* 5 · The online studio. */}
      <HomeStudio />

      {/* 6 · Why Packio — one lead claim and five things the business can show, figures from the API. */}
      <section aria-labelledby="home-benefits" className={SECTION}>
        <SectionHeading
          id="home-benefits"
          kicker={t("benefits.kicker")}
          title={t("benefits.heading")}
          description={t("benefits.sub")}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li className="bg-primary text-primary-fg rounded-card flex flex-col p-7 sm:col-span-2 lg:col-span-1 lg:row-span-2">
            <IconTile name="clock" tone="inverse" size="lg" className="mb-5" />
            <h3 className="font-display mb-2 text-2xl font-bold">{t("benefits.instantTitle")}</h3>
            <p className="text-primary-fg leading-relaxed">{t("benefits.instantLong")}</p>
            <Button
              asChild
              variant="secondary"
              className="text-primary-subtle-fg mt-6 h-11.5 self-start rounded-xl border-0 lg:mt-auto"
            >
              <Link href="/products">{t("benefits.instantCta")}</Link>
            </Button>
          </li>
          {benefits.map((benefit) => (
            <Card as="li" key={benefit.key} padding="lg" interactive>
              <IconTile name={benefit.icon} className="mb-4.5" />
              <h3 className="mb-1.5 text-lg font-bold">{t(`benefits.${benefit.key}Title`)}</h3>
              <p className="text-muted text-sm leading-relaxed">{benefit.body}</p>
            </Card>
          ))}
        </ul>
      </section>

      {/* 7 · Work and words from real customers — or the honest empty variant. */}
      {work.length === 0 && quotes.length === 0 ? (
        <section aria-labelledby="home-work" className={SECTION}>
          <KraftPanel className="grid items-center gap-8 p-7 md:grid-cols-[1.3fr_auto] md:p-14">
            <div className="relative">
              <Badge className="bg-surface/60 text-fg">{t("work.heading")}</Badge>
              <h2 id="home-work" className="font-display mt-3 text-3xl leading-tight font-bold md:text-4xl">
                {t("work.emptyTitle")}
              </h2>
              <p className="text-fg/80 mt-3 text-lg">{t("work.emptyBody")}</p>
            </div>
            <div className="relative">
              <Button asChild size="lg" iconEnd="arrow-right" className="rounded-xl">
                <Link href="/styles">{t("work.emptyAction")}</Link>
              </Button>
            </div>
          </KraftPanel>
        </section>
      ) : (
        <section aria-labelledby="home-work" className={SECTION}>
          <SectionHeading
            id="home-work"
            kicker={t("work.kicker")}
            title={t("work.heading")}
            action={quotes.length ? more("/reviews", t("work.allReviews")) : undefined}
          />
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
                      <blockquote>
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

      {/* 8 · Articles. */}
      {articles && articles.data.length > 0 ? (
        <section aria-labelledby="home-articles" className={SECTION}>
          <SectionHeading
            id="home-articles"
            kicker={t("sections.articlesKicker")}
            title={t("sections.articles")}
            action={more("/articles", t("sections.viewAll"))}
          />
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

      {/* 9 · Newsletter and how to reach us, on one dark band (the footer follows). */}
      <section aria-labelledby="home-closing" className={SECTION}>
        <div className="bg-fg text-fg-inverse relative grid gap-12 overflow-hidden rounded-2xl p-7 md:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div aria-hidden className="pk-band-glow absolute inset-0" />
          <div className="relative">
            <h2 id="home-closing" className="font-display text-3xl font-bold">
              {t("newsletter.heading")}
            </h2>
            <p className="text-fg-inverse/75 mt-2">{t("newsletter.body")}</p>
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
    <div className="border-fg-inverse/15 bg-fg-inverse/5 rounded-card relative flex flex-col border p-7">
      <h3 className="text-xl font-bold">{t("bandTitle")}</h3>
      {channels?.hours ? (
        <p className="text-fg-inverse/75 mt-2.5 flex items-center gap-2 text-sm">
          <Icon name="clock" size={16} />
          {t("hoursLine", { hours: channels.hours })}
        </p>
      ) : null}
      <dl className="text-fg-inverse/75 mt-3 grid gap-1 text-sm">
        {rows.map((row) =>
          row.value ? (
            <div key={row.key} className="flex gap-2">
              <dt>{t(row.key)}</dt>
              <dd>
                {row.href ? (
                  <a href={row.href} className="text-fg-inverse underline underline-offset-4">
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
        <Button asChild size="lg" variant="secondary" iconStart="chat" className="rounded-xl border-0">
          <Link href="/help/chat">{t("chat")}</Link>
        </Button>
        {rfqCategory ? (
          <Button asChild size="lg" variant="ghost" className="border-fg-inverse/25 rounded-xl border">
            <Link href={`/rfq/${encodeURIComponent(rfqCategory)}`}>{t("rfq")}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
