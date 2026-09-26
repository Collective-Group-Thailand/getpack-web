import { getLocale, getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, productSchema, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { ImageGallery } from "@/ui/components/ImageGallery";
import { Icon } from "@/ui/icons";

import { getPriceHints, type StockProduct } from "./api.server";
import { absoluteImageUrl, storeImageSrc } from "./images";
import { pick } from "./localize";
import { configureHref, stockProductHref } from "./paths";
import { priceHintText } from "./PriceHint";

/** A stock product (D-100 "standard / stock products"): ready-made, sold by the unit above a minimum. */
export async function StockProductView({ product }: { product: StockProduct }) {
  const [t, locale, format, origin, hints] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    publicOrigin(),
    getPriceHints({ skus: [product.sku] }),
  ]);
  const hint = hints.get(product.sku);
  const text = await priceHintText(hint);
  const name = pick(locale, product.nameTh, product.nameEn);
  const images = product.imageUrls
    .flatMap((url) => {
      const src = storeImageSrc(url);
      return src ? [{ src, alt: name }] : [];
    })
    .map((image, index, all) => ({
      ...image,
      thumbnailLabel: t("product.galleryShow", { index: index + 1, count: all.length }),
    }));
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const crumbs = [
    { label: t("breadcrumbs.home"), href: localised("/") },
    { label: t("breadcrumbs.products"), href: localised("/products") },
    { label: name },
  ];
  const dimensions = [product.lengthMm, product.widthMm, product.heightMm].filter((mm): mm is number => mm !== null);
  const unit = t(`stock.units.${product.unit}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <TrackOnView
        name="product_viewed"
        properties={{ route: "/products/[key]", productType: "standard_product", quoteMode: "instant" }}
      />
      <JsonLd
        data={productSchema({
          name,
          description: product.description,
          url: `${origin}${localised(stockProductHref(product.sku))}`,
          images: product.imageUrls.flatMap((url) => absoluteImageUrl(origin, url) ?? []),
          sku: product.sku,
          lowPrice: hint?.startingFromPerPiece,
          currency: hint?.currency,
        })}
      />
      <JsonLd
        data={breadcrumbSchema(
          crumbs.map((crumb) => ({ name: crumb.label, url: crumb.href ? `${origin}${crumb.href}` : undefined })),
        )}
      />
      <Breadcrumbs items={crumbs} label={t("breadcrumbs.label")} />

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
        <ImageGallery
          images={images}
          labels={{
            thumbnails: t("product.gallery"),
            empty: t("product.galleryEmpty"),
          }}
        />
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
              {t("card.stock")}
              <span className="font-mono">{product.sku}</span>
              <Badge tone={product.inStock ? "success" : "warning"}>
                {product.inStock ? t("stock.inStock") : t("stock.outOfStock")}
              </Badge>
              {product.isFoodGrade ? <Badge tone="info">{t("stock.foodGrade")}</Badge> : null}
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{name}</h1>
            {product.description ? <p className="text-muted mt-3 text-lg">{product.description}</p> : null}
          </div>

          <div className="border-border bg-bg-subtle rounded-xl border p-4">
            {text.price ? <p className="text-2xl font-semibold tabular-nums">{text.price}</p> : null}
            {text.basis ? <p className="text-muted mt-1 text-sm">{text.basis}</p> : null}
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Icon name="package" size={16} aria-hidden="true" />
              {t("stock.minOrder", { quantity: format.number(product.minOrderQty), unit })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {product.inStock ? (
              <Button asChild size="lg">
                <Link href={configureHref(product.sku)}>{t("stock.order")}</Link>
              </Button>
            ) : (
              <Button size="lg" disabled>
                {t("stock.order")}
              </Button>
            )}
            <Button asChild size="lg" variant="ghost">
              <Link href="/help/chat">{t("product.askCs")}</Link>
            </Button>
          </div>

          <section aria-labelledby="stock-details">
            <h2 id="stock-details" className="text-xl font-semibold">
              {t("stock.details")}
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              {dimensions.length > 0 ? (
                <div className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3">
                  <dt className="text-muted">{t("stock.dimensions")}</dt>
                  <dd className="tabular-nums">{dimensions.map((mm) => format.number(mm)).join(" × ")}</dd>
                </div>
              ) : null}
              {product.capacityMl !== null ? (
                <div className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3">
                  <dt className="text-muted">{t("stock.attributes")}</dt>
                  <dd>{t("stock.capacity", { ml: format.number(product.capacityMl) })}</dd>
                </div>
              ) : null}
              {product.attributes.map((attribute) => (
                <div
                  key={`${attribute.attribute}-${attribute.code}`}
                  className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3"
                >
                  <dt className="text-muted">{t("stock.attributes")}</dt>
                  <dd>{pick(locale, attribute.nameTh, attribute.nameEn)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
