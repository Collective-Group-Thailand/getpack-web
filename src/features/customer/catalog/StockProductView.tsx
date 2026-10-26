import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { breadcrumbSchema, productSchema, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { ImageGallery } from "@/ui/components/ImageGallery";
import { Icon } from "@/ui/icons";

import { getPriceHints, getProductTypes, type StockProduct } from "./api.server";
import { absoluteImageUrl, photoVariant, storeImageSrc } from "./images";
import { pick } from "./localize";
import { stockProductHref, stockRfqHref } from "./paths";
import { priceHintText } from "./PriceHint";
import { StockOrderPanel } from "./StockOrderPanel";

/** A stock product (D-100 "standard / stock products"): ready-made, sold by the unit above a minimum. */
export async function StockProductView({ product }: { product: StockProduct }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  const [t, locale, format, origin, hints, types] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    publicOrigin(),
    getPriceHints({ skus: [product.sku] }),
    getProductTypes(),
  ]);
  // Stock prices instantly only once its type's pricing is signed off (A-16); until then it is asked
  // for, not a cart button that cannot price (customer walkthrough 2026-10-17).
  const instant = types.some((type) => type.code === "standard_product" && type.quoteMode === "instant");
  const hint = hints.get(product.sku);
  const text = await priceHintText(hint);
  const name = pick(locale, product.nameTh, product.nameEn);
  const images = product.images
    .flatMap((image) => {
      const src = storeImageSrc(image.url);
      const photo = photoVariant(image.variant);
      return src ? [{ src, alt: photo ? pick(locale, photo.alt.th, photo.alt.en) : name }] : [];
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
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      <TrackOnView
        name="product_viewed"
        properties={{ route: "/products/[key]", productType: "standard_product", quoteMode: "instant" }}
      />
      <JsonLd
        data={productSchema({
          name,
          description: product.description,
          url: `${origin}${localised(stockProductHref(product.sku))}`,
          images: product.images.flatMap((image) => absoluteImageUrl(origin, image.url) ?? []),
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
        <div>
          <ImageGallery
            images={images}
            labels={{
              thumbnails: t("product.gallery"),
              empty: t("product.galleryEmpty"),
            }}
          />
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
              {t("card.stock")}
              <span className="tabular-nums">{product.sku}</span>
              <Badge tone={product.inStock ? "success" : "warning"}>
                {product.inStock ? t("stock.inStock") : t("stock.outOfStock")}
              </Badge>
              {product.isFoodGrade ? <Badge tone="info">{t("stock.foodGrade")}</Badge> : null}
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{name}</h1>
            {product.description ? <p className="text-muted mt-3 text-lg">{product.description}</p> : null}
          </div>

          <div className="border-border bg-bg-subtle rounded-xl border p-4">
            {text.price ? <p className="serif text-3xl tabular-nums">{text.price}</p> : null}
            {text.basis ? <p className="text-muted mt-1 text-sm">{text.basis}</p> : null}
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Icon name="package" size={16} aria-hidden="true" />
              {t("stock.minOrder", { quantity: format.number(product.minOrderQty), unit })}
            </p>
          </div>

          {product.inStock && !instant ? (
            <div className="flex flex-col gap-2">
              <Button asChild size="lg" iconStart="chat">
                <Link href={stockRfqHref(product.sku)}>{t("stock.askPrice")}</Link>
              </Button>
              <p className="text-muted text-sm">{t("stock.askPriceHint")}</p>
            </div>
          ) : product.inStock ? (
            <StockOrderPanel
              stockProductId={product.id}
              sku={product.sku}
              name={name}
              unit={unit}
              minOrderQty={product.minOrderQty}
              signedIn={signedIn}
            />
          ) : (
            <Button size="lg" disabled>
              {t("stock.outOfStock")}
            </Button>
          )}
          <Button asChild size="lg" variant="ghost" className="self-start">
            <Link href="/help/chat">{t("product.askCs")}</Link>
          </Button>

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
                  <dt className="text-muted">{t("stock.attributeLabels.capacity")}</dt>
                  <dd>{t("stock.capacity", { ml: format.number(product.capacityMl) })}</dd>
                </div>
              ) : null}
              {product.attributes.map((attribute) => (
                <div
                  key={`${attribute.attribute}-${attribute.code}`}
                  className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3"
                >
                  <dt className="text-muted">{t(`stock.attributeLabels.${attribute.attribute}`)}</dt>
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
