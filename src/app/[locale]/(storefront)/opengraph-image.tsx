import { getTranslations } from "next-intl/server";

import { OG_SIZE, renderOgCard } from "@/features/customer/seo/og-image";
import { BRAND_TAGLINE } from "@/ui/brand";

export const alt = "Packio";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The storefront's default Open Graph card, inherited by every page under this segment that
 * does not draw its own (a product, a style): the brand and its promise, in the page's language.
 */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  return renderOgCard({
    title: locale === "th" ? tCommon("brand.tagline") : BRAND_TAGLINE,
    subtitle: t("meta.description"),
  });
}
