import { getLocale, getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, faqPageSchema, productSchema, publicOrigin, webPageSchema } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { ImageGallery } from "@/ui/components/ImageGallery";
import { KraftPanel } from "@/ui/components/Decor";
import { productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import {
  getConfigurator,
  getPriceHints,
  getProductFaqs,
  getRfqForm,
  type CatalogueCategory,
  type ProductDetail,
  type ProductType,
} from "./api.server";
import { dielineTargetOf } from "./dieline-target";
import { absoluteImageUrl, photoVariant, storeImageSrc } from "./images";
import { pick } from "./localize";
import { categoryHref, configureHref, productHref, rfqHref } from "./paths";
import { priceHintText } from "./PriceHint";
import { ProductPicture } from "./ProductPicture";
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
  // "ดาวน์โหลดแบบกล่อง" goes to this product's own dieline at its default size, from the API's variants (D-271, D-441).
  const dielineHref =
    product.templateAvailability !== "online_template" && type?.quoteMode === "instant"
      ? dielineTargetOf(await getConfigurator(product.slug).catch(() => null))
      : null;
  const text = await priceHintText(hint);
  const name = pick(locale, product.nameTh, product.nameEn);
  const description = pick(locale, product.descriptionTh ?? "", product.descriptionEn) || null;
  const instant = type?.quoteMode === "instant";
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
      {/* The page as an ItemPage whose description paragraph is the speakable answer (AEO). */}
      {description ? (
        <JsonLd
          data={webPageSchema({
            type: "ItemPage",
            name,
            description,
            url: `${origin}${localised(productHref(product.slug))}`,
            locale,
            speakableSelector: ["#product-answer"],
          })}
        />
      ) : null}

      <Breadcrumbs items={crumbs} label={t("breadcrumbs.label")} />

      <div className="mt-6 grid gap-8 md:grid-cols-[1.15fr_1fr] md:gap-12">
        {images.length > 0 ? (
          <div>
            <ImageGallery
              images={images}
              labels={{
                thumbnails: t("product.gallery"),
                empty: t("product.galleryEmpty"),
              }}
            />
          </div>
        ) : (
          // No photo yet: the product's own dieline (its first pattern, at its first standard size),
          // not a "no image" box (UX audit, product detail).
          <ProductPicture
            dielineKey={product.patterns[0]?.dielineKey ?? null}
            size={product.standardSizes[0] ?? null}
            family={productFamilyOf(`${product.productTypeCode} ${product.slug}`)}
            badge={<Badge tone={instant ? "success" : "info"}>{instant ? t("card.instant") : t("card.rfq")}</Badge>}
            label={t("product.pictureLabel", { name })}
            caption={t("product.pictureCaption")}
          />
        )}

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-muted flex flex-wrap items-center gap-x-2 text-sm">
              {category && categoryName ? (
                <Link href={categoryHref(category.code)} className="text-primary font-medium hover:underline">
                  {categoryName}
                </Link>
              ) : null}
              {type && pick(locale, type.nameTh, type.nameEn) !== categoryName ? (
                <>
                  <span aria-hidden="true">·</span>
                  {pick(locale, type.nameTh, type.nameEn)}
                </>
              ) : null}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{name}</h1>
            {description ? (
              <p id="product-answer" className="text-muted mt-3 text-base leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>

          <div className="border-border bg-surface rounded-card border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {hint?.startingFromPerPiece ? (
                <p className="flex items-baseline gap-2">
                  <span className="text-muted text-sm">{t("price.fromLabel")}</span>
                  <span className="serif text-primary text-4xl tabular-nums md:text-[2.75rem]">
                    {format.thb(hint.startingFromPerPiece)}
                  </span>
                  <span className="text-muted text-sm">{t("price.perPiece")}</span>
                </p>
              ) : (
                <p className="text-lg font-semibold">{t("price.onRequest")}</p>
              )}
              {text.basis ? <p className="text-muted text-sm">{text.basis}</p> : null}
            </div>
            {/* Which specification the price is for (D-441): the API's one string, right under the price. */}
            {hint?.startingFromPerPiece && text.specs ? (
              <p id="product-price-spec" className="text-muted mt-1.5 text-sm leading-snug">
                {text.specs}
              </p>
            ) : null}

            <ul className="border-border mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
              {text.leadTime ? (
                <li className="flex items-center gap-2">
                  <Icon name="clock" size={16} aria-hidden="true" className="text-primary" />
                  {text.leadTime}
                </li>
              ) : null}
              {product.moq !== null ? (
                <li className="flex items-center gap-2">
                  <Icon name="box" size={16} aria-hidden="true" className="text-primary" />
                  {t("card.moq", { quantity: format.number(product.moq) })}
                </li>
              ) : null}
              <li>
                <Link href="/guarantee" className="text-primary flex items-center gap-2 hover:underline">
                  <Icon name="shield" size={16} aria-hidden="true" />
                  {t("product.guaranteeShort")}
                </Link>
              </li>
            </ul>

            <Button asChild size="lg" block className="mt-5" iconEnd="arrow-right">
              {instant ? (
                <Link href={configureHref(product.slug)}>{t("product.configure")}</Link>
              ) : (
                // `?from=` carries the product, so the request names it (breadcrumb, the team's context) and
                // the customer does not describe the serum box again (customer walkthrough 2026-10-16).
                <Link
                  href={`${rfqHref(category?.code ?? product.productTypeCode)}?from=${encodeURIComponent(product.slug)}`}
                >
                  {t("product.requestQuote")}
                </Link>
              )}
            </Button>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {product.templateAvailability === "online_template" ? (
                <Button asChild variant="secondary" iconStart="pen-tool">
                  {/* With the product, so the designer offers its patterns and materials and prices it. */}
                  <Link href={studioHref({ product: product.slug, step: "start" })}>{t("product.designOnline")}</Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" iconStart="download">
                  <Link href={dielineHref ?? (product.templateAvailability === "drawing" ? "/templates" : "/styles")}>
                    {t("product.downloadTemplate")}
                  </Link>
                </Button>
              )}
              <Button asChild variant="secondary" iconStart="chat">
                <Link href="/help/chat">{t("product.askCs")}</Link>
              </Button>
            </div>

            {/* The reference behind the starting price and the fine print, small and last (UX audit). */}
            <div className="text-muted mt-4 flex flex-col gap-1 text-xs leading-relaxed">
              <p>{instant ? t("product.priceNote") : t("product.rfqNote")}</p>
              {rfqForm?.slaTargetHours ? <p>{t("product.rfqSla", { hours: rfqForm.slaTargetHours })}</p> : null}
              <p>
                {t("product.toleranceNote")}{" "}
                <Link href="/guarantee" className="underline underline-offset-4">
                  {t("product.toleranceLink")}
                </Link>
              </p>
            </div>
          </div>

          {product.optionGroups.length > 0 || product.patterns.length > 0 ? (
            <section aria-labelledby="product-specs">
              <h2 id="product-specs" className="sr-only">
                {t("product.specs")}
              </h2>
              <dl className="border-border border-t">
                {product.patterns.length > 0 ? (
                  <div className="border-border grid grid-cols-[9rem_1fr] gap-3 border-b py-3.5">
                    <dt className="text-muted text-sm">{t("product.patterns")}</dt>
                    <dd className="text-sm">{product.patterns.map((pattern) => pattern.name).join(" · ")}</dd>
                  </div>
                ) : null}
                {product.optionGroups.map((group) => (
                  <div key={group.kind} className="border-border grid grid-cols-[9rem_1fr] gap-3 border-b py-3.5">
                    <dt className="text-muted text-sm">{t(`product.optionKinds.${group.kind}`)}</dt>
                    <dd className="text-sm">
                      {group.options.map((option) => pick(locale, option.nameTh, option.nameEn)).join(" · ")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-[1.15fr_1fr] md:gap-12">
        {product.standardSizes.length > 0 ? (
          <section aria-labelledby="product-sizes">
            <h2 id="product-sizes" className="text-2xl">
              {t("product.sizes")}
            </h2>
            {instant ? <p className="text-muted mt-1 text-sm">{t("product.sizesHint")}</p> : null}
            <div className="bg-surface border-border mt-4 overflow-x-auto rounded-xl border">
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
                    <tr
                      key={size.code}
                      className={cn(
                        "border-border relative border-t",
                        instant && "hover:bg-primary-subtle/50 focus-within:bg-primary-subtle/50",
                      )}
                    >
                      <td className="text-primary px-4 py-3 font-mono font-semibold">{size.code}</td>
                      <td className="px-4 py-3">
                        {instant ? (
                          // The whole row opens the configurator at this size (UX audit, product detail).
                          <Link
                            href={configureHref(product.slug, { size: size.code })}
                            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                          >
                            {size.name}
                          </Link>
                        ) : (
                          size.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {[size.lengthMm, size.widthMm, size.heightMm].map((mm) => format.number(mm)).join(" × ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-6">
          {instant ? (
            <KraftPanel className="p-7">
              <div className="relative">
                <h2 className="text-xl font-bold">{t("product.customSizeTitle")}</h2>
                <p className="mt-2 text-sm leading-relaxed">{t("product.customSizeBody")}</p>
                <Button asChild className="bg-fg text-fg-inverse hover:bg-fg/90 mt-5">
                  <Link href={configureHref(product.slug)}>{t("product.customSizeCta")}</Link>
                </Button>
              </div>
            </KraftPanel>
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
                className="border-border hover:border-primary rounded-control inline-flex border px-3 py-1.5 text-sm"
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
