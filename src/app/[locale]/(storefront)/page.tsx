import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getLibraryTotals,
  getSupportChannels,
  listAllStyles,
  listFaqs,
  listStockProducts,
  listStyles,
} from "@/features/customer/catalog/api.server";
import { getHomeContent } from "@/features/customer/home/content.server";
import {
  CustomerCases,
  HomeContact,
  HomeFaq,
  HomeHero,
  PhotoMosaic,
  isPackagingCategory,
  ProductRows,
  QualityBand,
  ScreenToFactory,
  StockShelfSection,
  StudioCapabilities,
  TemplateGallery,
  TrustRow,
} from "@/features/customer/home/HomeSections";
import { lowestPresetQty } from "@/features/customer/home/studio-hero";
import { getStudioHero } from "@/features/customer/home/studio-hero.server";
import { homeTemplates } from "@/features/customer/home/templates";
import { getGuarantee } from "@/features/customer/trust/api.server";
import { readAccessToken } from "@/lib/auth/session";

/**
 * The storefront home, Studio-first (Phase 4, the V4 "Main" board — design language v3): the hero
 * with the working Studio panel · the trust row · the ready-to-ship shelf (one tap to the cart) ·
 * photos of real work · the template gallery ·
 * screen to factory · customer stories (only with three approved) · what the studio checks · the
 * sage quality band · what we make · questions · contact and the newsletter.
 *
 * Every figure comes from the API (the template count, the minimum order, the factories, the
 * claim window, the panel's prices) and every photo from the CMS; a block with nothing real to
 * show is left out — never a placeholder, an invented review or a statistic.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [content, tree, styles, published, faqs, channels, guarantee, hero, library, stock, jar] = await Promise.all([
    getHomeContent(locale),
    getCatalogueTree(),
    listStyles({ sort: "popular", limit: 7 }).catch(() => null),
    // The curated templates are looked up in the whole (cached) library; popular ones fill any gap.
    listAllStyles().catch(() => []),
    listFaqs().catch(() => []),
    getSupportChannels(),
    getGuarantee().catch(() => null),
    getStudioHero(),
    getLibraryTotals(),
    // The ready-to-ship shelf picks a varied two dozen from these; a failure leaves the shelf out.
    listStockProducts({ perPage: 100 }).catch(() => null),
    cookies(),
  ]);

  // Instant-price categories lead, as they lead the catalogue (UX audit step 4). Only packaging
  // a customer configures: the `standard_product` and `service` types are bookkeeping, not a range.
  const categories = tree
    .filter(isPackagingCategory)
    .sort(
      (a, b) =>
        Number(b.types.some((type) => type.availability !== "rfq")) -
        Number(a.types.some((type) => type.availability !== "rfq")),
    );
  const styleCategories = styles?.facets.category ?? [];
  const templateCount = styleCategories.reduce((sum, facet) => sum + facet.count, 0);

  return (
    <>
      <HomeHero
        hero={hero}
        photo={content.photos.hero}
        facts={{
          templates: templateCount > 0 ? templateCount : null,
          // D-410: "986 แบบ ออกแบบเองได้ทุกแบบ" — every shown variant, as the API counts it.
          library: library?.variants ?? null,
          // The lowest quantity the hero presets offer — what the panel beside it starts from.
          moq: lowestPresetQty(hero.shapes),
        }}
      />
      <TrustRow />
      {stock ? (
        <StockShelfSection
          items={stock.data}
          total={stock.meta.total}
          signedIn={Boolean(readAccessToken(jar))}
          instant={tree.some((category) =>
            category.types.some((type) => type.code === "standard_product" && type.quoteMode === "instant"),
          )}
        />
      ) : null}
      {content.photos.mosaic ? <PhotoMosaic photos={content.photos.mosaic} /> : null}
      <TemplateGallery
        styles={homeTemplates(published, styles?.data ?? [])}
        total={templateCount}
        categories={styleCategories.filter((facet) => facet.count > 0).length}
        library={library}
        photos={content.photos.templates}
        locale={locale}
      />
      <ScreenToFactory sample={content.photos.process.sample} packing={content.photos.process.packing} />
      {content.cases.length > 0 ? <CustomerCases cases={content.cases} /> : null}
      <StudioCapabilities />
      <QualityBand photo={content.photos.quality} claimDays={guarantee?.claimWindowDays ?? null} />
      <ProductRows categories={categories} photos={content.photos.categories} locale={locale} />
      <HomeFaq groups={faqs} locale={locale} hours={channels?.hours ?? null} />
      <HomeContact channels={channels} />
    </>
  );
}
