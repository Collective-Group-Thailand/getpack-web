import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getConfigurator,
  getProduct,
  getProductTypes,
  getSharedConfiguration,
  getSharedQuote,
  getSupportChannels,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { productHref, rfqHref } from "@/features/customer/catalog/paths";
import { getMyDisplayUnit, getMyDraft, getMyQuote, listMyDraftsOf } from "@/features/customer/configurator/api.server";
import { seedFromConfiguration } from "@/features/customer/configurator/build";
import { Configurator } from "@/features/customer/configurator/Configurator";
import { seedFromDefaults } from "@/features/customer/configurator/defaults";
import { seedFromDesign, type ConfiguratorState } from "@/features/customer/configurator/state";
import { getDefaults } from "@/features/customer/account/api.server";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Callout } from "@/ui/components/Callout";

type Params = { slug: string };
type Search = {
  share?: string;
  quote?: string;
  draft?: string;
  config?: string;
  pattern?: string;
  material?: string;
  l?: string;
  w?: string;
  d?: string;
  /** The home page's quick start (U-F3): a quantity, and where it came from. */
  qty?: string;
  from?: string;
  /** A standard size's code (the product page's size table). */
  size?: string;
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [t, locale, product] = await Promise.all([getTranslations("configurator"), getLocale(), getProduct(slug)]);
  if (!product) return {};
  const name = pick(locale, product.nameTh, product.nameEn);
  // The product page is the one to index; this is its tool, and a shared link carries a token.
  return { title: t("meta.title", { name }), robots: { index: false, follow: true } };
}

/**
 * The configurator and instant quote for one catalogue product (F3 3.2, U2.F1). Rendered per
 * request: it reads the session cookie (whether "add to cart" can act at once, the customer's
 * display unit and drafts) and a shared quote's or configuration's token. The catalogue reads
 * underneath are cached (`api.server.ts`).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const { share, quote: quoteId, draft: draftId, config } = search;
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

  const signedIn = Boolean(readAccessToken(jar));
  const [shared, saved, draft, sharedConfig, unit, drafts, defaults] = await Promise.all([
    share ? getSharedQuote(share) : null,
    // One of the customer's own saved quotations, reopened from the account (F3 3.4).
    quoteId && signedIn ? getMyQuote(quoteId) : null,
    // One of the customer's drafts, resumed (D-185); another product's draft is not this page's.
    draftId && signedIn ? getMyDraft(draftId) : null,
    config ? getSharedConfiguration(config) : null,
    signedIn ? getMyDisplayUnit() : ("mm" as const),
    signedIn && !draftId ? listMyDraftsOf(configurator.catalogProductId) : [],
    // Pre-fill from the last quotation of this type (D-298); a failed read starts from the catalogue.
    signedIn ? getDefaults().catch(() => null) : null,
  ]);
  const ownDraft = draft && draft.catalogProductId === configurator.catalogProductId ? draft : null;
  const ownShared =
    sharedConfig && sharedConfig.catalogProductId === configurator.catalogProductId ? sharedConfig : null;
  const quote = saved ?? shared;
  // A draft, a shared configuration or a saved / shared quote wins; otherwise a design's
  // "order this" may have filled the size in.
  const source = ownDraft ?? ownShared;
  const seed: Partial<ConfiguratorState> = {
    unit,
    ...(source
      ? seedFromConfiguration(configurator, source.configuration, { target: ownDraft?.targetPricePerUnit ?? null })
      : quote
        ? seedFromConfiguration(configurator, (quote.configuration ?? {}) as unknown as Record<string, unknown>, {
            quantity: quote.options[0]?.quantity,
            target: quote.targetPricePerUnit,
          })
        : (seedFromDesign(configurator, search) ?? seedFromDefaults(configurator, defaults?.productTypes ?? []))),
  };
  const name = pick(locale, product.nameTh, product.nameEn);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });

  return (
    <div className="max-w-content mx-auto px-5 py-6 md:px-8 md:py-10">
      <Breadcrumbs
        label={tCatalog("breadcrumbs.label")}
        items={[
          { label: tCatalog("breadcrumbs.home"), href: localised("/") },
          { label: tCatalog("breadcrumbs.products"), href: localised("/products") },
          { label: name, href: localised(productHref(slug)) },
          { label: t("breadcrumb") },
        ]}
      />
      <p className="eyebrow mt-4">{t("eyebrow")}</p>
      <h1 className="mt-3 text-[2.375rem] leading-tight">{t("heading", { name })}</h1>
      <p className="text-muted mt-2 max-w-2xl">{t("intro")}</p>
      {share && !shared ? (
        <Callout tone="warning" className="mt-4 max-w-2xl">
          {t("sharedExpired")}
        </Callout>
      ) : null}
      {config && !ownShared ? (
        <Callout tone="warning" className="mt-4 max-w-2xl">
          {t("sharedConfigExpired")}
        </Callout>
      ) : null}
      {ownShared ? (
        <Callout tone="info" className="mt-4 max-w-2xl">
          {t("sharedConfigFrom", {
            title: ownShared.title ?? name,
            pct: Math.round(ownShared.completenessPct),
          })}
        </Callout>
      ) : null}
      {shared ? (
        <Callout tone="info" className="mt-4 max-w-2xl">
          {shared.quoteCode ? t("sharedFrom", { code: shared.quoteCode }) : t("sharedFromNoCode")}
        </Callout>
      ) : null}
      {saved ? (
        <Callout tone="info" className="mt-4 max-w-2xl">
          {saved.quoteCode ? t("savedFrom", { code: saved.quoteCode }) : t("savedFromNoCode")}
        </Callout>
      ) : null}
      {draftId && !ownDraft ? (
        <Callout tone="warning" className="mt-4 max-w-2xl">
          {t("draftGone")}
        </Callout>
      ) : null}
      {ownDraft ? (
        <Callout tone="info" className="mt-4 max-w-2xl">
          {t("draftResumed", { title: ownDraft.title ?? name })}
        </Callout>
      ) : null}
      {!source && !quote && drafts.length > 0 ? (
        <Callout tone="info" className="mt-4 max-w-2xl" title={t("draftsTitle", { count: drafts.length })}>
          <ul className="mt-1 flex flex-col gap-1">
            {drafts.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/configure/${slug}?draft=${entry.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("draftResume", {
                    title: entry.title ?? name,
                    pct: Math.round(entry.completenessPct),
                  })}
                </Link>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <div className="mt-6">
        <Configurator
          configurator={configurator}
          productName={{ th: product.nameTh, en: product.nameEn }}
          signedIn={signedIn}
          lineOaId={support?.lineOaId ?? null}
          seed={seed}
          draft={ownDraft}
          rfqPath={rfqPath}
          pageUrl={`${origin}${localised(`/configure/${slug}`)}`}
        />
      </div>
    </div>
  );
}
