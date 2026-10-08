import { setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getSupportChannels,
  listFaqs,
  listStyles,
  publicApi,
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
  StudioCapabilities,
  TemplateGallery,
  TrustRow,
} from "@/features/customer/home/HomeSections";
import { getStudioHero } from "@/features/customer/home/studio-hero.server";
import { getGuarantee, getNetworkStats } from "@/features/customer/trust/api.server";

/**
 * The storefront home, Studio-first (Phase 4, the V4 "Main" board — design language v3): the hero
 * with the working Studio panel · the trust row · photos of real work · the template gallery ·
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

  const [content, tree, styles, faqs, channels, guarantee, network] = await Promise.all([
    getHomeContent(locale),
    getCatalogueTree(),
    listStyles({ sort: "popular", limit: 7 }).catch(() => null),
    listFaqs().catch(() => []),
    getSupportChannels(),
    getGuarantee().catch(() => null),
    getNetworkStats().catch(() => null),
  ]);
  // `store.publicConfig.get` (D-309): the minimum order the storefront states.
  const [config, hero] = await Promise.all([
    publicApi("catalogue")
      .then((api) => api.GET("/v1/store/public-config"))
      .then((response) => response.data ?? null)
      .catch(() => null),
    getStudioHero(),
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
  const factories = network?.network.published ? network.network.partnerCount : null;

  return (
    <>
      <HomeHero
        hero={hero}
        photo={content.photos.hero}
        facts={{
          templates: templateCount > 0 ? templateCount : null,
          // The made-to-order minimum from public config — never a catalogue floor worked out here.
          moq: config?.minOrderQty.custom ?? null,
        }}
      />
      <TrustRow />
      {content.photos.mosaic ? <PhotoMosaic photos={content.photos.mosaic} /> : null}
      <TemplateGallery
        styles={styles?.data ?? []}
        total={templateCount}
        categories={styleCategories.filter((facet) => facet.count > 0).length}
        photos={content.photos.templates}
        locale={locale}
      />
      <ScreenToFactory sample={content.photos.process.sample} packing={content.photos.process.packing} />
      {content.cases.length > 0 ? <CustomerCases cases={content.cases} /> : null}
      <StudioCapabilities />
      <QualityBand
        photo={content.photos.quality}
        factories={factories}
        claimDays={guarantee?.claimWindowDays ?? null}
      />
      <ProductRows categories={categories} locale={locale} />
      <HomeFaq groups={faqs} locale={locale} hours={channels?.hours ?? null} />
      <HomeContact channels={channels} />
    </>
  );
}
