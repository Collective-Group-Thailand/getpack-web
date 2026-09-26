import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getConfigurator,
  getProduct,
  getProductTypes,
  getSharedQuote,
  getSupportChannels,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { productHref, rfqHref } from "@/features/customer/catalog/paths";
import { seedFromConfiguration } from "@/features/customer/configurator/build";
import { Configurator } from "@/features/customer/configurator/Configurator";
import { getPathname, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Callout } from "@/ui/components/Callout";

type Params = { slug: string };
type Search = { share?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [t, locale, product] = await Promise.all([getTranslations("configurator"), getLocale(), getProduct(slug)]);
  if (!product) return {};
  const name = pick(locale, product.nameTh, product.nameEn);
  // The product page is the one to index; this is its tool, and a shared link carries a token.
  return { title: t("meta.title", { name }), robots: { index: false, follow: true } };
}

/**
 * The configurator and instant quote for one catalogue product (F3 3.2). Rendered per request:
 * it reads the session cookie (whether "add to cart" can act at once) and a shared quote's token.
 * The catalogue reads underneath are cached (`api.server.ts`).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ slug }, { share }] = await Promise.all([params, searchParams]);
  const [t, tCatalog, locale, product, configurator, types, support, jar, origin] = await Promise.all([
    getTranslations("configurator"),
    getTranslations("catalog"),
    getLocale(),
    getProduct(slug),
    getConfigurator(slug),
    getProductTypes(),
    getSupportChannels(),
    cookies(),
    publicOrigin(),
  ]);
  if (!product) notFound();
  const type = types.find((candidate) => candidate.code === product.productTypeCode);
  const rfqPath = rfqHref(type?.categoryCode ?? product.productTypeCode);
  // Quoted on request only (D-043, D-100): the RFQ form is this product's configurator.
  if (!configurator) return redirect({ href: `${rfqPath}?from=${encodeURIComponent(slug)}`, locale });

  const shared = share ? await getSharedQuote(share) : null;
  const seed = shared ? seedFromConfiguration(configurator, shared.configuration, shared.quantity) : undefined;
  const name = pick(locale, product.nameTh, product.nameEn);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Breadcrumbs
        label={tCatalog("breadcrumbs.label")}
        items={[
          { label: tCatalog("breadcrumbs.home"), href: localised("/") },
          { label: tCatalog("breadcrumbs.products"), href: localised("/products") },
          { label: name, href: localised(productHref(slug)) },
          { label: t("breadcrumb") },
        ]}
      />
      <h1 className="mt-4 text-2xl font-bold md:text-3xl">{t("heading", { name })}</h1>
      <p className="text-muted mt-2 max-w-2xl">{t("intro")}</p>
      {share && !shared ? (
        <Callout tone="warning" className="mt-4 max-w-2xl">
          {t("sharedExpired")}
        </Callout>
      ) : null}
      {shared ? (
        <Callout tone="info" className="mt-4 max-w-2xl">
          {t("sharedFrom", { code: shared.quoteCode })}
        </Callout>
      ) : null}
      <div className="mt-6">
        <Configurator
          configurator={configurator}
          productName={{ th: product.nameTh, en: product.nameEn }}
          signedIn={Boolean(readAccessToken(jar))}
          lineOaId={support?.lineOaId ?? null}
          seed={seed}
          rfqPath={rfqPath}
          pageUrl={`${origin}${localised(`/configure/${slug}`)}`}
        />
      </div>
    </div>
  );
}
