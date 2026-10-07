import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listStyles } from "@/features/customer/catalog/api.server";
import { listRecentDesigns } from "@/features/customer/designer/api.server";
import { StudioHome } from "@/features/customer/studio/StudioHome";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio.home");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** How many of the customer's designs the front door lists before "see all". */
const RECENT = 3;

/**
 * `/studio` — Packio Studio's front door (Phase 4 §4.4, the "StudioStart" board). The editor itself
 * stays at `/studio/new` and `/studio/<design id>`. Leaving the studio never ends the session: the
 * BFF refreshes one token at a time (round 2, B4), and nothing here or in the editor signs out.
 */
export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const jar = await cookies();
  const signedIn = Boolean(readAccessToken(jar));
  const [styles, recent] = await Promise.all([
    listStyles({ sort: "popular", limit: 3 }).catch(() => null),
    signedIn ? listRecentDesigns(RECENT).catch(() => null) : Promise.resolve(null),
  ]);
  const templateCount = styles?.facets.category.reduce((sum, facet) => sum + facet.count, 0) ?? null;

  return (
    <StudioHome
      signedIn={signedIn}
      popular={styles?.data ?? []}
      templateCount={templateCount || null}
      designs={recent?.data ?? []}
      designTotal={recent?.total ?? 0}
      locale={locale}
    />
  );
}
