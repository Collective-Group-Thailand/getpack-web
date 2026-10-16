import { getTranslations } from "next-intl/server";

import { resolveProductKey } from "@/features/customer/catalog/resolve.server";
import { pick } from "@/features/customer/catalog/localize";
import { OG_SIZE, renderOgCard } from "@/features/customer/seo/og-image";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

export const alt = "getpack";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The card for a category, a catalogue product or a stock product: its name, and under it the
 * "starting from" price when the API gives one, or the category's own description. A key that
 * resolves to nothing gets the brand card, never a 404 image.
 */
export default async function Image({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  const [resolved, t] = await Promise.all([resolveProductKey(key), getTranslations({ locale, namespace: "catalog" })]);

  if (!resolved) return renderOgCard({ title: t("meta.productsTitle") });

  if (resolved.kind === "category") {
    const name = pick(locale, resolved.category.nameTh, resolved.category.nameEn);
    return renderOgCard({ eyebrow: t("breadcrumbs.products"), title: name, subtitle: t("meta.categoryDescription", { name }) });
  }

  if (resolved.kind === "product") {
    const { product } = resolved;
    const name = pick(locale, product.nameTh, product.nameEn);
    const from = product.startingPricePerPiece
      ? t("price.from", { price: formatTHB(product.startingPricePerPiece, locale as Locale) })
      : null;
    return renderOgCard({ eyebrow: t("breadcrumbs.products"), title: name, subtitle: from });
  }

  const name = pick(locale, resolved.product.nameTh, resolved.product.nameEn);
  return renderOgCard({ eyebrow: t("breadcrumbs.products"), title: name, subtitle: resolved.product.description });
}
