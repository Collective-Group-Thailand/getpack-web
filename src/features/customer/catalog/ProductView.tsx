import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { loadHubItems } from "@/features/customer/products/catalogue.server";
import { HubSection, MaterialsTable } from "@/features/customer/products/HubSections";
import { QuoteTrayProvider } from "@/features/customer/products/quote-tray";
import { RfqTray } from "@/features/customer/products/RfqTray";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LineFloat } from "@/features/customer/shell/LineFloat";
import { defaultPatternOf } from "@/features/customer/configurator/state";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env/server";
import { breadcrumbSchema, faqPageSchema, productSchema, publicOrigin, webPageSchema } from "@/lib/seo";
import { AnchorNav } from "@/ui/components/AnchorNav";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { studioHref } from "@/features/customer/studio/paths";

import {
  getConfigurator,
  getPriceHints,
  getProductFaqs,
  getRfqForm,
  getSupportChannels,
  type CatalogueCategory,
  type ProductDetail,
  type ProductType,
} from "./api.server";
import { dielineTargetOf } from "./dieline-target";
import { absoluteImageUrl, photoVariant, storeImageSrc } from "./images";
import { pick } from "./localize";
import { categoryHref, configureHref, productHref, rfqHref } from "./paths";
import { hasDesignPaths, hasStandardSizes, materialsOf } from "./pdp/model";
import { PdpBuyBox } from "./pdp/PdpBuyBox";
import { PdpDesignPaths } from "./pdp/PdpDesignPaths";
import { PdpGallery, type PdpPhoto } from "./pdp/PdpGallery";
import { PdpMobileBar } from "./pdp/PdpMobileBar";
import { PdpProvider } from "./pdp/PdpProvider";
import { PdpFaq, pdpFaqEntries, PdpOrderFlow, PdpPrintNotes, PdpRelated } from "./pdp/PdpSections";
import { PdpSizesTable } from "./pdp/PdpSizes";
import { PdpTiers, PdpTiersLede } from "./pdp/PdpTiers";
import { priceHintText } from "./PriceHint";
import { ProductPicture } from "./ProductPicture";

const BUY_BOX_ID = "buy";
const GUARANTEE = "/guarantee";
const RELATED = 4;

/**
 * A catalogue product's page (pdp redesign Phase 1, `docs/design/pdp-redesign/`): breadcrumb; the
 * gallery (real photos, else the product's own dieline, plus "ขนาดจริง") sticky beside the buy box; a
 * sticky section bar; sizes, price by quantity, materials and print, artwork routes, the configurator's
 * steps, questions and related products. An instant product's buy box is the configurator's own state,
 * priced by the configurator's own calculation and handed to it unchanged (`pdp/model.ts`); a product
 * priced by quotation keeps its "starting from" figure and the request. A part without data is left out.
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
  const instant = type?.quoteMode === "instant";
  const [t, tCatalog, locale, format, origin, hints, faqs, support, jar, configurator, related] = await Promise.all([
    getTranslations("catalog.pdp"),
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    publicOrigin(),
    getPriceHints({ slugs: [product.slug] }),
    getProductFaqs(product.slug),
    getSupportChannels(),
    cookies(),
    instant ? getConfigurator(product.slug).catch(() => null) : Promise.resolve(null),
    category ? loadHubItems({ category: category.code }).catch(() => null) : Promise.resolve(null),
  ]);
  // The buy box needs a configurator the API prices instantly; without one the page keeps the quotation path.
  const live = configurator?.instant ? configurator : null;
  // How quickly CS answers an RFQ for this type, as the form states it (D-100).
  const rfqForm = type && !instant ? await getRfqForm(type.code).catch(() => null) : null;
  const signedIn = Boolean(readAccessToken(jar));
  const hint = hints.get(product.slug);
  const text = await priceHintText(hint);
  const name = pick(locale, product.nameTh, product.nameEn);
  const description = pick(locale, product.descriptionTh ?? "", product.descriptionEn) || null;
  const categoryName = category ? pick(locale, category.nameTh, category.nameEn) : undefined;
  const unit = tCatalog(`stock.units.${configurator?.unit ?? "piece"}`);

  const photos: PdpPhoto[] = product.images.flatMap((image) => {
    const src = storeImageSrc(image.url);
    const variant = photoVariant(image.variant);
    return src
      ? [
          {
            src,
            thumb: storeImageSrc(image.url, "thumb") ?? src,
            alt: variant ? pick(locale, variant.alt.th, variant.alt.en) : name,
          },
        ]
      : [];
  });
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const crumbs = [
    { label: tCatalog("breadcrumbs.home"), href: localised("/") },
    { label: t("breadcrumbProducts"), href: localised("/products") },
    ...(category && categoryName ? [{ label: categoryName, href: localised(categoryHref(category.code)) }] : []),
    { label: name },
  ];

  const faqEntries = await pdpFaqEntries({
    configurator: live,
    leadTime: hint?.leadTimeBusinessDays
      ? hint.leadTimeBusinessDays.min === hint.leadTimeBusinessDays.max
        ? String(hint.leadTimeBusinessDays.min)
        : `${hint.leadTimeBusinessDays.min}–${hint.leadTimeBusinessDays.max}`
      : null,
    productFaqs: faqs.map((faq) => ({
      question: pick(locale, faq.questionTh, faq.questionEn),
      answer: pick(locale, faq.answerTh, faq.answerEn),
    })),
  });

  const relatedItems = (related?.items ?? [])
    .filter((item) => !(item.kind === "catalog" && item.key === product.slug))
    .slice(0, RELATED);

  // The pattern this product is (its default spec's), for the "structure" pill.
  const pattern = live ? defaultPatternOf(live) : (product.patterns[0] ?? null);
  const lead = hint?.leadTimeBusinessDays ?? null;
  const pills = [
    instant ? (
      <Badge key="instant" tone="instant" icon="zap">
        {t("pills.instant")}
      </Badge>
    ) : (
      <Badge key="rfq" tone="info">
        {t("pills.rfq")}
      </Badge>
    ),
    pattern ? (
      <Badge key="pattern" tone="neutral">
        {pattern.name}
      </Badge>
    ) : null,
    product.moq !== null ? (
      <Badge key="moq" tone="neutral">
        {t("pills.moq", { quantity: format.number(product.moq), unit })}
      </Badge>
    ) : null,
    lead ? (
      <Badge key="lead" tone="neutral">
        {lead.min === lead.max
          ? t("pills.lead", { days: lead.min })
          : t("pills.leadRange", { min: lead.min, max: lead.max })}
      </Badge>
    ) : null,
  ].filter(Boolean);

  const sizesShown = live ? hasStandardSizes(live) : product.standardSizes.length > 0;
  const materialsShown = live ? materialsOf(live).length > 0 : false;
  const sections = [
    ...(sizesShown ? [{ id: "size", label: t("nav.size") }] : []),
    ...(live ? [{ id: "price", label: t("nav.price") }] : []),
    ...(materialsShown ? [{ id: "materials", label: t("nav.materials") }] : []),
    ...(live && hasDesignPaths(live) ? [{ id: "design", label: t("nav.design") }] : []),
    ...(live ? [{ id: "how", label: t("nav.how") }] : []),
    ...(faqEntries.length > 0 ? [{ id: "faq", label: t("nav.faq") }] : []),
  ];

  const container = "max-w-nav mx-auto px-5 md:px-8 xl:px-12";
  // "กำหนดขนาดเอง": the configurator's custom-size tab, started from the default standard size (its own link).
  const startSize = live?.standardSizes.find((size) => size.isDefault) ?? live?.standardSizes[0] ?? null;
  const customSizeHref = configureHref(
    product.slug,
    startSize ? { size: `${startSize.lengthMm}x${startSize.widthMm}x${startSize.heightMm}` } : {},
  );
  const fallbackDieline = product.templateAvailability === "drawing" ? "/templates" : "/styles";
  const online = product.templateAvailability === "online_template";
  const picture = (
    <ProductPicture
      dielineKey={(live ? defaultPatternOf(live)?.dielineKey : product.patterns[0]?.dielineKey) ?? null}
      size={live?.standardSizes.find((size) => size.isDefault) ?? product.standardSizes[0] ?? null}
      family={productFamilyOf(`${product.productTypeCode} ${product.slug}`)}
      label={tCatalog("product.pictureLabel", { name })}
      caption={tCatalog("product.pictureCaption")}
      className="aspect-square"
    />
  );

  const head = (
    <div className="flex flex-col gap-2">
      {category && categoryName ? (
        <Link
          href={categoryHref(category.code)}
          className="text-primary self-start text-[0.8125rem] font-medium hover:underline"
        >
          {categoryName}
        </Link>
      ) : null}
      <h1 className="m-0 text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.375rem]">
        {name}
      </h1>
      {description ? (
        <p id="product-answer" className="text-muted m-0 text-pretty">
          {description}
        </p>
      ) : null}
      {pills.length > 0 ? <div className="mt-1 flex flex-wrap gap-1.5">{pills}</div> : null}
    </div>
  );

  const page = (
    <>
      <div className={`${container} pt-6 md:pt-8`}>
        <Breadcrumbs items={crumbs} label={tCatalog("breadcrumbs.label")} />
      </div>

      <div
        className={cn(
          container,
          "grid items-start gap-8 pt-4 min-[1040px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[1040px]:gap-10",
        )}
      >
        <PdpGallery photos={photos} fallback={picture} />
        <div id={BUY_BOX_ID} className="flex scroll-mt-[calc(var(--site-sticky-top)+1rem)] flex-col gap-4.5">
          {head}
          {live ? (
            <PdpBuyBox
              dielineFallback={fallbackDieline}
              studioHref={online ? studioHref({ product: product.slug, step: "start" }) : null}
              guaranteeHref={GUARANTEE}
              materialsAnchor={materialsShown ? "materials" : null}
            />
          ) : (
            <QuoteBox
              product={product}
              instant={instant}
              categoryCode={category?.code ?? null}
              hintText={text}
              hintPrice={hint?.startingFromPerPiece ?? null}
              rfqHours={rfqForm?.slaTargetHours ?? null}
              dielineHref={
                online
                  ? studioHref({ product: product.slug, step: "start" })
                  : (dielineTargetOf(configurator) ?? fallbackDieline)
              }
            />
          )}
        </div>
      </div>

      {sections.length > 0 ? (
        <AnchorNav aria-label={t("nav.label")} items={sections} className="mt-10" innerClassName={container} />
      ) : null}

      <div className={`${container} pb-24`}>
        {sizesShown ? (
          <HubSection
            id="size"
            title={t("sizes.title", { count: (live?.standardSizes ?? product.standardSizes).length })}
            lede={t("sizes.lede")}
          >
            {live ? <PdpSizesTable buyBoxId={BUY_BOX_ID} /> : <StaticSizes product={product} />}
            {live || instant ? (
              <div className="border-border bg-surface rounded-card mt-3 grid grid-cols-1 items-center gap-4 border p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <span aria-hidden="true" className="bg-bg-subtle text-muted grid size-11 place-items-center rounded-xl">
                  <Icon name="ruler" size={22} />
                </span>
                <span>
                  <b className="block text-base font-semibold">{t("sizes.customTitle")}</b>
                  <small className="text-muted text-sm">{t("sizes.customBody")}</small>
                </span>
                <Button asChild variant="secondary">
                  <Link href={customSizeHref}>{t("sizes.customCta")}</Link>
                </Button>
              </div>
            ) : null}
          </HubSection>
        ) : null}

        {live ? (
          <HubSection id="price" title={t("tiers.title")} lede={<PdpTiersLede />}>
            <PdpTiers guaranteeHref={GUARANTEE} />
          </HubSection>
        ) : null}

        {live && materialsShown ? (
          <MaterialsTable
            configurators={[live]}
            section={{ id: "materials", title: t("materials.title"), lede: t("materials.lede") }}
            after={<PdpPrintNotes configurator={live} />}
          />
        ) : null}

        {live && hasDesignPaths(live) ? (
          <HubSection id="design" title={t("design.title")} lede={t("design.lede")}>
            <PdpDesignPaths />
          </HubSection>
        ) : null}

        {live ? <PdpOrderFlow configurator={live} /> : null}

        <PdpFaq entries={faqEntries} />

        <PdpRelated
          items={relatedItems}
          categoryName={categoryName ?? null}
          categoryHref={category ? categoryHref(category.code) : null}
        />
      </div>

      {live ? <PdpMobileBar /> : null}
    </>
  );

  return (
    <QuoteTrayProvider signedIn={signedIn} account={featureFlags.rfqProductRef}>
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

      {live ? (
        <PdpProvider configurator={live} productName={name} signedIn={signedIn}>
          {page}
        </PdpProvider>
      ) : (
        page
      )}
      <RfqTray />
      <LineFloat apiLineOaId={support?.lineOaId} />
    </QuoteTrayProvider>
  );
}

/**
 * The buy box of a product priced by quotation (or one whose configurator is unavailable): the
 * "starting from" figure where the API has one, with its basis and spec (D-441), and the request.
 */
async function QuoteBox({
  product,
  instant,
  categoryCode,
  hintText,
  hintPrice,
  rfqHours,
  dielineHref,
}: {
  product: ProductDetail;
  instant: boolean;
  categoryCode: string | null;
  hintText: Awaited<ReturnType<typeof priceHintText>>;
  hintPrice: string | null;
  rfqHours: number | null;
  dielineHref: string;
}) {
  const [t, tCatalog, format] = await Promise.all([
    getTranslations("catalog.pdp"),
    getTranslations("catalog"),
    getFormat(),
  ]);
  const online = product.templateAvailability === "online_template";
  return (
    <div className="border-border bg-surface rounded-card flex flex-col gap-4 border p-5">
      <div>
        {hintPrice ? (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted text-sm">{tCatalog("price.fromLabel")}</span>
            <b className="text-[2.125rem] leading-none font-semibold tracking-tight tabular-nums md:text-[2.625rem]">
              {format.thb(hintPrice)}
            </b>
            <span className="text-muted">{tCatalog("price.perPiece")}</span>
          </p>
        ) : (
          <p className="m-0 text-lg font-semibold">{tCatalog("price.onRequest")}</p>
        )}
        {hintText.basis ? <p className="text-muted mt-2 text-[0.8125rem]">{hintText.basis}</p> : null}
        {/* Which specification the price is for (D-441): the API's one string, right under the price. */}
        {hintPrice && hintText.specs ? (
          <p id="product-price-spec" className="text-muted mt-1 text-xs leading-snug">
            {hintText.specs}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button asChild size="lg" block className="sm:col-span-2" iconEnd="arrow-right">
          {instant ? (
            <Link href={configureHref(product.slug)}>{t("cta.configure")}</Link>
          ) : (
            // `?from=` carries the product, so the request names it and the customer does not describe it again.
            <Link href={`${rfqHref(categoryCode ?? product.productTypeCode)}?from=${encodeURIComponent(product.slug)}`}>
              {t("cta.requestQuote")}
            </Link>
          )}
        </Button>
        <Button asChild variant="secondary" iconStart={online ? "pen-tool" : "download"}>
          <Link href={dielineHref}>{online ? t("cta.designOnline") : t("cta.dielineAny")}</Link>
        </Button>
        <Button asChild variant="secondary" iconStart="chat">
          <Link href="/help/chat">{t("cta.ask")}</Link>
        </Button>
      </div>
      <div className="text-muted flex flex-col gap-1 text-xs leading-relaxed">
        <p className="m-0">{instant ? tCatalog("product.priceNote") : tCatalog("product.rfqNote")}</p>
        {rfqHours ? <p className="m-0">{tCatalog("product.rfqSla", { hours: rfqHours })}</p> : null}
        <p className="m-0">
          {tCatalog("product.toleranceNote")}{" "}
          <Link href={GUARANTEE} className="underline underline-offset-4">
            {tCatalog("product.toleranceLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** The standard sizes of a product without an instant configurator: code, name and inside size. */
async function StaticSizes({ product }: { product: ProductDetail }) {
  const [t, format] = await Promise.all([getTranslations("catalog.pdp.sizes"), getFormat()]);
  const head = "text-muted bg-bg-subtle px-3.5 py-3 text-start text-[0.78125rem] font-medium";
  return (
    <div
      className="border-border bg-surface rounded-card relative overflow-x-auto border"
      tabIndex={0}
      role="region"
      aria-label={t("caption")}
    >
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={head}>
              {t("code")}
            </th>
            <th scope="col" className={head}>
              {t("inside")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {product.standardSizes.map((size) => (
            <tr key={size.code}>
              <th scope="row" className="text-primary px-3.5 py-2.5 text-start font-semibold">
                {size.code}
              </th>
              <td className="px-3.5 py-2.5">
                {[size.lengthMm, size.widthMm, size.heightMm].map((mm) => format.number(mm)).join(" × ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
