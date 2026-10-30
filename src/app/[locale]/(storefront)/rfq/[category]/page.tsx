import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getCatalogueTree,
  getProduct,
  getRfqForm,
  getStockProduct,
  getStyle,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { categorySegment, productHref, rfqHref } from "@/features/customer/catalog/paths";
import { styleHref } from "@/features/customer/styles/paths";
import { QuoteTrayProvider } from "@/features/customer/products/quote-tray";
import { TrayProgress } from "@/features/customer/products/TrayProgress";
import { RfqForm } from "@/features/customer/rfq/RfqForm";
import { featureFlags } from "@/lib/env/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { readAccessToken } from "@/lib/auth/session";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Params = { category: string };
/** A calculation id from the configurator, checked for its shape only — the API decides the rest. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Search = {
  type?: string;
  from?: string;
  sku?: string;
  calc?: string;
  base?: string;
  style?: string;
  /** `1` when the products hub's RFQ tray walks its items through this form (C1). */
  tray?: string;
};
/** A style code as the API writes it (`PK-TE-01`, `PK-TE-01-K7QD`). */
const STYLE_CODE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

async function resolve(segment: string) {
  const tree = await getCatalogueTree();
  return tree.find((candidate) => categorySegment(candidate.code) === segment) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: segment } = await params;
  const [t, locale, category] = await Promise.all([getTranslations("quoteRequests"), getLocale(), resolve(segment)]);
  if (!category) return {};
  const name = pick(locale, category.nameTh, category.nameEn);
  return { title: t("meta.title", { name }), description: t("meta.description", { name }) };
}

/**
 * A request for quotation for one category (F3 3.2, D-100): every type that has no instant
 * price, and any spec the configurator could not price (D-043) — `?from=<product>` says which.
 * From a style page, `?base=&style=` names the published variant to quote (D-407), sent with the
 * request. A category with several product types asks which one first.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ category: segment }, query] = await Promise.all([params, searchParams]);
  const [t, tCatalog, locale, category, jar] = await Promise.all([
    getTranslations("quoteRequests"),
    getTranslations("catalog"),
    getLocale(),
    resolve(segment),
    cookies(),
  ]);
  if (!category) notFound();
  const product = query.from ? await getProduct(query.from) : null;
  // A stock item asked about from the home shelf or its page while stock is quote-only (A-16).
  const stock = query.sku ? await getStockProduct(query.sku) : null;
  // The variant a style page asked about: kept only when the base lists it among its shown variants.
  const styleBase =
    STYLE_CODE.test(query.base ?? "") && STYLE_CODE.test(query.style ?? "") ? await getStyle(query.base!) : null;
  const chosenVariant = styleBase?.variants.find((variant) => variant.code === query.style) ?? null;
  const type =
    category.types.find((candidate) => candidate.code === query.type) ??
    category.types.find((candidate) => candidate.code === product?.productTypeCode) ??
    (stock ? category.types.find((candidate) => candidate.code === "standard_product") : undefined) ??
    category.types.find((candidate) => chosenVariant && candidate.code === styleBase?.productTypeCode) ??
    (category.types.length === 1 ? category.types[0] : undefined);
  const form = type ? await getRfqForm(type.code) : null;
  if (type && !form) notFound();

  const name = pick(locale, category.nameTh, category.nameEn);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  // The tray item this form is for (C1): the product the hub's tray holds, by slug or SKU.
  const trayItem =
    query.tray === "1" && (product || stock)
      ? product
        ? { kind: "catalog" as const, key: product.slug }
        : { kind: "stock" as const, key: stock!.sku }
      : null;
  // DECISIONS-STAGE-A §4: the request keeps the product it is for (sent once the API takes it).
  const productRef = featureFlags.rfqProductRef
    ? product
      ? { catalogProductSlug: product.slug }
      : stock
        ? { stockProductSku: stock.sku }
        : null
    : null;

  // "How it works" in three numbered steps: the side panel's head beside the form, above the list of types.
  const howSteps = (
    <ol className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
      {(["step1", "step2", "step3"] as const).map((step, index) => (
        <li key={step} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg text-[0.8125rem] font-semibold tabular-nums",
              index === 0 ? "bg-primary text-primary-fg" : "bg-primary-subtle text-primary-subtle-fg",
            )}
          >
            {index + 1}
          </span>
          <span className={index === 0 ? "pt-1 font-medium" : "text-muted pt-1"}>{t(`how.${step}`)}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <QuoteTrayProvider signedIn={Boolean(readAccessToken(jar))} account={featureFlags.rfqProductRef}>
      <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
        <Breadcrumbs
          label={tCatalog("breadcrumbs.label")}
          items={[
            { label: tCatalog("breadcrumbs.home"), href: localised("/") },
            { label: tCatalog("breadcrumbs.products"), href: localised("/products") },
            ...(product
              ? [{ label: pick(locale, product.nameTh, product.nameEn), href: localised(productHref(product.slug)) }]
              : []),
            { label: t("breadcrumb") },
          ]}
        />
        <h1 className="mt-3 text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
          {t("heading", { name })}
        </h1>
        <p className="text-muted mt-2 max-w-[60ch] text-pretty">{t("intro")}</p>

        {!type ? (
          <section aria-labelledby="rfq-types" className="mt-8 max-w-3xl">
            <div className="border-border bg-surface rounded-card mb-8 border p-5">{howSteps}</div>
            <h2 id="rfq-types" className="text-lg font-semibold">
              {t("chooseType")}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.types.map((candidate) => (
                <li key={candidate.code}>
                  <Card className="p-0">
                    <Link
                      href={`${rfqHref(category.code)}?${new URLSearchParams({
                        type: candidate.code,
                        ...(chosenVariant ? { base: styleBase!.code, style: chosenVariant.code } : {}),
                      }).toString()}`}
                      className="hover:bg-bg-subtle flex items-center justify-between gap-3 rounded-xl p-4 font-medium"
                    >
                      {pick(locale, candidate.nameTh, candidate.nameEn)}
                      <Icon name="chevron-right" size={16} aria-hidden="true" />
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section aria-labelledby="rfq-form" className="mt-8">
            <h2 id="rfq-form" className="text-lg font-semibold">
              {t("formHeading", { type: pick(locale, type.nameTh, type.nameEn) })}
            </h2>
            {trayItem ? <TrayProgress current={trayItem} className="mt-4" /> : null}
            <div className="mt-4">
              <RfqForm
                tray={trayItem}
                productRef={productRef}
                aside={howSteps}
                form={withProductChoices(form!, product, tCatalog)}
                signedIn={Boolean(readAccessToken(jar))}
                fromProduct={
                  product
                    ? { slug: product.slug, name: pick(locale, product.nameTh, product.nameEn) }
                    : stock
                      ? { slug: stock.sku, name: pick(locale, stock.nameTh, stock.nameEn) }
                      : null
                }
                initialNotes={
                  stock
                    ? t("stockNote", {
                        name: pick(locale, stock.nameTh, stock.nameEn),
                        sku: stock.sku,
                        minimum: stock.minOrderQty,
                      })
                    : ""
                }
                calculationId={product && UUID.test(query.calc ?? "") ? query.calc! : null}
                style={
                  chosenVariant && styleBase
                    ? {
                        code: chosenVariant.code,
                        name: pick(locale, styleBase.nameTh, styleBase.nameEn),
                        href: styleHref(styleBase.code, pick(locale, styleBase.nameTh, styleBase.nameEn)),
                      }
                    : null
                }
              />
            </div>
          </section>
        )}
      </div>
    </QuoteTrayProvider>
  );
}

type RfqFormDto = Schemas["StoreRfqFormDto"];
type RfqField = Schemas["RfqFormFieldDto"];

/**
 * A type whose schema asks nothing lets the customer type the spec into the notes — while the
 * product page they came from had just listed what can be chosen (styles, materials, coatings;
 * customer walkthrough 2026-10-16). When the form has no fields and the product has choices, each
 * choice group becomes an optional select whose key the API labels (`material`, `coating`, …).
 */
function withProductChoices(
  form: RfqFormDto,
  product: Awaited<ReturnType<typeof getProduct>> | null,
  tCatalog: (key: string) => string,
): RfqFormDto {
  if (form.fields.length > 0 || !product) return form;
  const fields: RfqField[] = [];
  const field = (key: string, labelKey: string, options: { value: string; labelTh: string; labelEn: string }[]) => {
    if (options.length === 0) return;
    const label = tCatalog(`product.optionKinds.${labelKey}`);
    fields.push({
      key,
      type: "select",
      labelTh: label,
      labelEn: label,
      helpTh: null,
      helpEn: null,
      unit: null,
      required: false,
      min: null,
      max: null,
      options,
    });
  };
  field(
    "pattern",
    "pattern",
    product.patterns.map((pattern) => ({ value: pattern.name, labelTh: pattern.name, labelEn: pattern.name })),
  );
  for (const group of product.optionGroups) {
    field(
      group.kind,
      group.kind,
      group.options.map((option) => ({ value: option.nameTh, labelTh: option.nameTh, labelEn: option.nameEn })),
    );
  }
  return fields.length > 0 ? { ...form, fields } : form;
}
