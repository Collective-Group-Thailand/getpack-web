import { getLocale, getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, faqPageSchema, productSchema, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { ImageGallery } from "@/ui/components/ImageGallery";
import { Icon } from "@/ui/icons";

import {
  getPriceHints,
  getProductFaqs,
  getRfqForm,
  type CatalogueCategory,
  type ProductDetail,
  type ProductType,
} from "./api.server";
import { absoluteImageUrl, storeImageSrc } from "./images";
import { pick } from "./localize";
import { categoryHref, configureHref, productHref, rfqHref } from "./paths";
import { priceHintText } from "./PriceHint";
import { studioHref } from "@/features/customer/studio/paths";

/**
 * A catalogue product's page: pictures, what it is, what it costs to start and how long it
 * takes (from the API), the choices it comes in, its standard sizes and its questions — and
 * one next step: configure and price it (instant, D-043) or ask for a quote (RFQ).
 */
export async function ProductView({
  product,
  type,
  category,
}: {
  product: ProductDetail;
  type?: ProductType;
  category?: CatalogueCategory;
}) {
  const [t, locale, format, origin, hints, faqs] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    publicOrigin(),
    getPriceHints({ slugs: [product.slug] }),
    getProductFaqs(product.slug),
  ]);
  // How quickly CS answers an RFQ for this type, as the form states it (D-100).
  const rfqForm = type && type.quoteMode !== "instant" ? await getRfqForm(type.code).catch(() => null) : null;
  const related = (category?.types ?? []).filter((other) => other.code !== product.productTypeCode).slice(0, 4);
  const hint = hints.get(product.slug);
  const text = await priceHintText(hint);
  const name = pick(locale, product.nameTh, product.nameEn);
  const description = pick(locale, product.descriptionTh ?? "", product.descriptionEn) || null;
  const instant = type?.quoteMode === "instant";
  const images = product.images
    .flatMap((image) => {
      const src = storeImageSrc(image.url);
      return src ? [{ src, alt: name }] : [];
    })
    .map((image, index, all) => ({
      ...image,
      thumbnailLabel: t("product.galleryShow", { index: index + 1, count: all.length }),
    }));
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const categoryName = category ? pick(locale, category.nameTh, category.nameEn) : undefined;
  const crumbs = [
    { label: t("breadcrumbs.home"), href: localised("/") },
    { label: t("breadcrumbs.products"), href: localised("/products") },
    ...(category && categoryName ? [{ label: categoryName, href: localised(categoryHref(category.code)) }] : []),
    { label: name },
  ];
  const faqEntries = faqs.map((faq) => ({
    question: pick(locale, faq.questionTh, faq.questionEn),
    answer: pick(locale, faq.answerTh, faq.answerEn),
  }));

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      <TrackOnView
        name="product_viewed"
        properties={{ route: "/products/[key]", productType: product.productTypeCode, quoteMode: type?.quoteMode }}
      />
      <JsonLd
        data={productSchema({
          name,
          description,
          url: `${origin}${localised(productHref(product.slug))}`,
          images: product.images.flatMap((image) => absoluteImageUrl(origin, image.url) ?? []),
          category: categoryName,
          lowPrice: hint?.startingFromPerPiece,
          currency: hint?.currency,
        })}
      />
      <JsonLd
        data={breadcrumbSchema(
          crumbs.map((crumb) => ({ name: crumb.label, url: crumb.href ? `${origin}${crumb.href}` : undefined })),
        )}
      />
      {faqEntries.length > 0 ? <JsonLd data={faqPageSchema(faqEntries)} /> : null}

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
            {type ? (
              <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
                {pick(locale, type.nameTh, type.nameEn)}
                <Badge tone={instant ? "success" : "info"}>{instant ? t("card.instant") : t("card.rfq")}</Badge>
              </p>
            ) : null}
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{name}</h1>
            {description ? <p className="text-muted mt-3 text-lg">{description}</p> : null}
          </div>

          <div className="border-border bg-bg-subtle rounded-xl border p-4">
            {text.price ? <p className="text-2xl font-semibold tabular-nums">{text.price}</p> : null}
            {text.basis ? <p className="text-muted mt-1 text-sm">{text.basis}</p> : null}
            {text.specs ? (
              <p className="text-muted mt-1 text-sm">{t("product.priceBasisSpecs", { specs: text.specs })}</p>
            ) : null}
            {text.leadTime ? (
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Icon name="clock" size={16} aria-hidden="true" />
                {text.leadTime}
              </p>
            ) : null}
            {product.moq !== null ? (
              <p className="mt-1 flex items-center gap-2 text-sm">
                <Icon name="package" size={16} aria-hidden="true" />
                {t("card.moq", { quantity: format.number(product.moq) })}
              </p>
            ) : null}
            <p className="text-muted mt-3 text-xs">{instant ? t("product.priceNote") : t("product.rfqNote")}</p>
            {rfqForm?.slaTargetHours ? (
              <p className="text-muted mt-1 text-xs">{t("product.rfqSla", { hours: rfqForm.slaTargetHours })}</p>
            ) : null}
            <p className="text-muted mt-1 text-xs">
              {t("product.toleranceNote")}{" "}
              <Link href="/guarantee" className="underline underline-offset-4">
                {t("product.toleranceLink")}
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {instant ? (
              <Button asChild size="lg">
                <Link href={configureHref(product.slug)}>{t("product.configure")}</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={rfqHref(category?.code ?? product.productTypeCode)}>{t("product.requestQuote")}</Link>
              </Button>
            )}
            {product.templateAvailability === "online_template" ? (
              <Button asChild size="lg" variant="secondary">
                {/* With the product, so the designer offers its patterns and materials and prices it. */}
                <Link href={studioHref({ product: product.slug, step: "start" })}>{t("product.designOnline")}</Link>
              </Button>
            ) : null}
            {product.templateAvailability === "drawing" ? (
              <Button asChild size="lg" variant="secondary">
                <Link href="/templates">{t("product.downloadTemplate")}</Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="ghost">
              <Link href="/help/chat">{t("product.askCs")}</Link>
            </Button>
          </div>
          <p className="text-muted mt-3 text-sm">
            <Icon name="shield" size={14} className="me-1 inline" aria-hidden="true" />
            <Link href="/guarantee" className="text-primary underline underline-offset-4">
              {t("product.guarantee")}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        {product.optionGroups.length > 0 ? (
          <section aria-labelledby="product-specs">
            <h2 id="product-specs" className="text-xl font-semibold">
              {t("product.specs")}
            </h2>
            <dl className="mt-4 flex flex-col gap-3">
              {product.optionGroups.map((group) => (
                <div key={group.kind} className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3">
                  <dt className="text-muted text-sm">{t(`product.optionKinds.${group.kind}`)}</dt>
                  <dd className="text-sm">
                    {group.options.map((option) => pick(locale, option.nameTh, option.nameEn)).join(" · ")}
                  </dd>
                </div>
              ))}
              {product.patterns.length > 0 ? (
                <div className="border-border grid grid-cols-[8rem_1fr] gap-3 border-b pb-3">
                  <dt className="text-muted text-sm">{t("product.patterns")}</dt>
                  <dd className="text-sm">{product.patterns.map((pattern) => pattern.name).join(" · ")}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {product.standardSizes.length > 0 ? (
          <section aria-labelledby="product-sizes">
            <h2 id="product-sizes" className="text-xl font-semibold">
              {t("product.sizes")}
            </h2>
            <div className="border-border mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("product.sizesCaption", { name })}</caption>
                <thead className="bg-bg-subtle text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-start font-medium">
                      {t("product.sizeCode")}
                    </th>
                    <th scope="col" className="px-4 py-2 text-start font-medium">
                      {t("product.sizeName")}
                    </th>
                    <th scope="col" className="px-4 py-2 text-end font-medium">
                      {t("product.sizeDimensions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.standardSizes.map((size) => (
                    <tr key={size.code} className="border-border border-t">
                      <td className="px-4 py-2 font-mono">{size.code}</td>
                      <td className="px-4 py-2">{size.name}</td>
                      <td className="px-4 py-2 text-end tabular-nums">
                        {[size.lengthMm, size.widthMm, size.heightMm].map((mm) => format.number(mm)).join(" × ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {product.videos.length > 0 ? (
          <section aria-labelledby="product-videos">
            <h2 id="product-videos" className="text-xl font-semibold">
              {t("product.videos")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {product.videos.map((video) => (
                <li key={video.url}>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-2 underline underline-offset-2"
                  >
                    <Icon name="play" size={16} aria-hidden="true" />
                    {video.title ?? video.url}
                    <Icon name="external" size={14} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="product-more" className="mt-12">
        <h2 id="product-more" className="text-xl font-semibold">
          {t("product.more")}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {related.map((other) => (
            <li key={other.code}>
              <Link
                href={`/products?productType=${encodeURIComponent(other.code)}`}
                className="border-border hover:border-primary inline-flex rounded-full border px-3 py-1.5 text-sm"
              >
                {pick(locale, other.nameTh, other.nameEn)}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/materials"
              className="text-primary inline-flex px-3 py-1.5 text-sm underline underline-offset-4"
            >
              {t("product.materials")}
            </Link>
          </li>
        </ul>
      </section>

      {faqEntries.length > 0 ? (
        <section aria-labelledby="product-faqs" className="mt-12 max-w-3xl">
          <h2 id="product-faqs" className="text-xl font-semibold">
            {t("product.faqs")}
          </h2>
          <DisclosureList
            className="mt-4"
            items={faqEntries.map((entry) => ({ summary: entry.question, content: entry.answer }))}
          />
        </section>
      ) : null}
    </div>
  );
}
