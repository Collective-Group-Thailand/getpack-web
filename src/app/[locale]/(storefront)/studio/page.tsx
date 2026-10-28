import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getLibraryTotals, getStudioFeatured, listStyles } from "@/features/customer/catalog/api.server";
import { listRecentDesigns } from "@/features/customer/designer/api.server";
import { getStudioHero } from "@/features/customer/home/studio-hero.server";
import { getOrderTabCounts } from "@/features/customer/orders/api.server";
import { StudioHub } from "@/features/customer/studio/hub/StudioHub";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio.home");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** How many of the customer's designs the front door lists before "see all". */
const RECENT = 3;
/** Real style pictures on the "เลือกแบบกล่อง" card (studio redesign Phase 1 item 3). */
const PICTURED = 4;

/**
 * `/studio` — getpack Studio's one front door (studio redesign Phase 1, C7). The editor stays at `/studio/new?…`
 * and `/studio/<design id>`; a bare `/studio/new` redirects here. Every loader fails soft: a missing part hides its
 * section rather than the page.
 */
export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const jar = await cookies();
  const signedIn = Boolean(readAccessToken(jar));
  const [hero, totals, styles, featured, recent, tabs] = await Promise.all([
    getStudioHero().catch(() => ({ shapes: [], initial: null })),
    getLibraryTotals(),
    listStyles({ limit: 12 }).catch(() => null),
    getStudioFeatured(),
    signedIn ? listRecentDesigns(RECENT).catch(() => null) : Promise.resolve(null),
    signedIn ? getOrderTabCounts().catch(() => null) : Promise.resolve(null),
  ]);
  // Styles with a photo or rendered thumbnail first; the rest show their engine-drawn dieline (never an illustration).
  const list = styles?.data ?? [];
  const pictured = [
    ...list.filter((style) => style.photo || style.thumbnailUrl),
    ...list.filter((style) => !style.photo && !style.thumbnailUrl),
  ].slice(0, PICTURED);
  const product = typeof query.product === "string" && /^[a-z0-9-]{1,120}$/.test(query.product) ? query.product : null;

  return (
    <StudioHub
      locale={locale}
      signedIn={signedIn}
      hero={hero}
      libraryStyles={totals?.styles ?? null}
      pictured={pictured}
      featured={featured.data}
      designs={recent?.data ?? []}
      designTotal={recent?.total ?? 0}
      hasOrders={tabs ? tabs.active + tabs.completed > 0 : false}
      productSlug={product}
    />
  );
}
