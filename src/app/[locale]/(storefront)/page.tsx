import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  getBanners,
  getCatalogueTree,
  getHomeSections,
  getPriceHints,
  listArticles,
  listProducts,
  listShowcase,
  type Banner,
  type CatalogueCategory,
  type HomeSection,
} from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref, categoryHref, productHref } from "@/features/customer/catalog/paths";
import { ProductGrid } from "@/features/customer/catalog/ProductGrid";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { ProductCard } from "@/ui/components/ProductCard";
import { Icon } from "@/ui/icons";

/**
 * The storefront home: a hero, then the sections the marketing team arranges in the back
 * office (`GET /v1/store/catalog/home-sections`, F2.5) in their order — packaging types,
 * featured products, customer showcase, articles — and how ordering works.
 *
 * Nothing on it is a claim the data does not back (design-system.md §5): no invented review
 * counts or delivery statistics. A section the API does not send is simply not there.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon, sections, tree, heroBanners, stripBanners] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getHomeSections().catch(() => []),
    getCatalogueTree(),
    getBanners("home_hero"),
    getBanners("home_strip"),
  ]);
  const hero = heroBanners[0];

  const steps = [
    { title: t("steps.chooseTitle"), body: t("steps.chooseBody") },
    { title: t("steps.designTitle"), body: t("steps.designBody") },
    { title: t("steps.produceTitle"), body: t("steps.produceBody") },
  ];

  return (
    <>
      <section className="bg-bg-subtle">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="text-4xl leading-tight font-bold md:text-5xl">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>
            <p className="text-muted mt-4 max-w-md text-lg">{t("hero.body", { tagline: tCommon("brand.tagline") })}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/products">{t("hero.browse")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/design/new">{tCommon("nav.startDesigning")}</Link>
              </Button>
            </div>
          </div>
          {hero ? (
            <HeroBanner banner={hero} />
          ) : (
            <Card elevation="raised" padding="lg" className="aspect-[4/3] rounded-2xl">
              {/* The product, not a stock photo: a real dieline from @packio/dieline. */}
              <BoxPreview
                style="tuck-end"
                dims={{ length: 70, width: 40, height: 110 }}
                paper="ivory-350"
                label={t("hero.preview")}
              />
            </Card>
          )}
        </div>
      </section>

      {stripBanners.length > 0 ? (
        <section aria-label={t("sections.promotions")} className="mx-auto max-w-6xl px-4 pt-8">
          <ul className="grid gap-3 md:grid-cols-2">
            {stripBanners.map((banner) => (
              <li key={banner.title}>
                <StripBanner banner={banner} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.map((section) => (
        <HomeSectionBlock key={section.slug} section={section} tree={tree} locale={locale} />
      ))}

      <section className="bg-bg-subtle mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-semibold">{t("steps.heading")}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
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
    </>
  );
}

/** A banner's target is an admin-entered path; only a path inside the site becomes a link. */
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
    <Link href={target} className="focus-visible:ring-focus-ring block rounded-2xl outline-none focus-visible:ring-2">
      {image}
    </Link>
  ) : (
    image
  );
}

function StripBanner({ banner }: { banner: Banner }) {
  const src = storeImageSrc(banner.mobileImageUrl ?? banner.desktopImageUrl);
  const target = bannerTarget(banner.targetUrl);
  const body = (
    <span className="border-border bg-surface flex items-center gap-4 rounded-xl border p-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
        <img src={src} alt="" width={96} height={72} loading="lazy" className="h-18 w-24 rounded-lg object-cover" />
      ) : null}
      <span className="font-medium">{banner.title}</span>
    </span>
  );
  return target ? (
    <Link href={target} className="focus-visible:ring-focus-ring block rounded-xl outline-none focus-visible:ring-2">
      {body}
    </Link>
  ) : (
    body
  );
}

const limitOf = (section: HomeSection, fallback: number) => {
  const limit = Number((section.config as { limit?: unknown }).limit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 24) : fallback;
};

async function HomeSectionBlock({
  section,
  tree,
  locale,
}: {
  section: HomeSection;
  tree: CatalogueCategory[];
  locale: string;
}) {
  const t = await getTranslations("home");
  const fallbackTitle = {
    product_types: t("sections.productTypes"),
    catalog_products: t("sections.featured"),
    showcase: t("sections.showcase"),
    articles: t("sections.articles"),
    banner: t("sections.promotions"),
    custom: t("sections.featured"),
  }[section.kind];
  const title = pick(locale, section.titleTh ?? fallbackTitle, section.titleEn) || fallbackTitle;
  const id = `home-${section.slug}`;

  const frame = (content: React.ReactNode, more?: { href: string; label: string }) => (
    <section aria-labelledby={id} className="mx-auto max-w-6xl px-4 pt-16">
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
      {content}
    </section>
  );

  switch (section.kind) {
    case "product_types": {
      if (tree.length === 0) return null;
      return frame(
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tree.map((category) => (
            <li key={category.code}>
              <Link
                href={categoryHref(category.code)}
                className="border-border bg-surface hover:bg-bg-subtle focus-visible:ring-focus-ring flex h-full flex-col gap-2 rounded-xl border p-4 outline-none focus-visible:ring-2"
              >
                <Icon name="box" size={24} className="text-primary" aria-hidden="true" />
                <span className="font-medium">{pick(locale, category.nameTh, category.nameEn)}</span>
              </Link>
            </li>
          ))}
        </ul>,
        { href: "/products", label: t("sections.viewAll") },
      );
    }
    case "catalog_products": {
      const products = await listProducts({ perPage: limitOf(section, 8) }).catch(() => null);
      if (!products || products.data.length === 0) return null;
      const hints = await getPriceHints({ slugs: products.data.map((product) => product.slug) });
      const types = new Map(tree.flatMap((category) => category.types).map((type) => [type.code, type]));
      return frame(
        <ProductGrid
          items={products.data.map((product) => ({ kind: "catalog" as const, product }))}
          types={types}
          hints={hints}
          eager={0}
        />,
        { href: "/products", label: t("sections.viewAll") },
      );
    }
    case "showcase": {
      const showcase = await listShowcase({ perPage: limitOf(section, 8) }).catch(() => null);
      if (!showcase || showcase.data.length === 0) return null;
      return frame(
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {showcase.data.map((item) => {
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
        </ul>,
      );
    }
    case "articles": {
      const [articles, format] = await Promise.all([
        listArticles({ perPage: limitOf(section, 3) }).catch(() => null),
        getFormat(),
      ]);
      if (!articles || articles.data.length === 0) return null;
      return frame(
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
        </ul>,
        { href: "/articles", label: t("sections.viewAll") },
      );
    }
    default:
      // `banner` sections are the strip above; `custom` has no agreed shape to render yet.
      return null;
  }
}
