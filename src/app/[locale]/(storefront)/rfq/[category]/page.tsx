import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCatalogueTree, getProduct, getRfqForm } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { categorySegment, productHref, rfqHref } from "@/features/customer/catalog/paths";
import { RfqForm } from "@/features/customer/rfq/RfqForm";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";

type Params = { category: string };
/** A calculation id from the configurator, checked for its shape only — the API decides the rest. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Search = { type?: string; from?: string; calc?: string };

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
 * A category with several product types asks which one first.
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
  const type =
    category.types.find((candidate) => candidate.code === query.type) ??
    category.types.find((candidate) => candidate.code === product?.productTypeCode) ??
    (category.types.length === 1 ? category.types[0] : undefined);
  const form = type ? await getRfqForm(type.code) : null;
  if (type && !form) notFound();

  const name = pick(locale, category.nameTh, category.nameEn);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
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
      <h1 className="mt-4 text-2xl font-bold md:text-3xl">{t("heading", { name })}</h1>
      <p className="text-muted mt-2">{t("intro")}</p>
      <ol className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {(["step1", "step2", "step3"] as const).map((step, index) => (
          <li key={step} className="bg-surface border-border flex gap-2 rounded-lg border p-3">
            <span className="text-primary font-semibold tabular-nums">{index + 1}</span>
            {t(`how.${step}`)}
          </li>
        ))}
      </ol>

      {!type ? (
        <section aria-labelledby="rfq-types" className="mt-8">
          <h2 id="rfq-types" className="text-lg font-semibold">
            {t("chooseType")}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {category.types.map((candidate) => (
              <li key={candidate.code}>
                <Card className="p-0">
                  <Link
                    href={`${rfqHref(category.code)}?type=${candidate.code}`}
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
          <div className="mt-4">
            <RfqForm
              form={form!}
              signedIn={Boolean(readAccessToken(jar))}
              fromProduct={product ? { slug: product.slug, name: pick(locale, product.nameTh, product.nameEn) } : null}
              calculationId={product && UUID.test(query.calc ?? "") ? query.calc! : null}
            />
          </div>
        </section>
      )}
    </div>
  );
}
