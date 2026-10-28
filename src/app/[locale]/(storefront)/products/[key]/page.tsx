import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { CategoryView } from "@/features/customer/catalog/CategoryView";
import { readHubParams } from "@/features/customer/products/query";
import { absoluteImageUrl } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { ProductView } from "@/features/customer/catalog/ProductView";
import { resolveProductKey } from "@/features/customer/catalog/resolve.server";
import { StockProductView } from "@/features/customer/catalog/StockProductView";
import { publicOrigin } from "@/lib/seo";

type Params = Promise<{ locale: string; key: string }>;
type SearchParams = Promise<{
  type?: string | string[];
  page?: string | string[];
  sort?: string | string[];
  view?: string | string[];
  mode?: string | string[];
  use?: string | string[];
  size?: string | string[];
}>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { key } = await params;
  const [resolved, locale, t, origin] = await Promise.all([
    resolveProductKey(key),
    getLocale(),
    getTranslations("catalog"),
    publicOrigin(),
  ]);
  if (!resolved) return {};

  if (resolved.kind === "category") {
    const name = pick(locale, resolved.category.nameTh, resolved.category.nameEn);
    return { title: name, description: t("meta.categoryDescription", { name }) };
  }

  if (resolved.kind === "product") {
    const { product } = resolved;
    const name = pick(locale, product.nameTh, product.nameEn);
    const seo = product.seo;
    const image = absoluteImageUrl(origin, product.imageUrl);
    return {
      // SEO fields an admin set win (F2.5's SEO pages); the product's own name and text otherwise.
      title: seo?.title ?? name,
      description: seo?.description ?? pick(locale, product.descriptionTh ?? "", product.descriptionEn) ?? undefined,
      keywords: seo?.keywords ?? undefined,
      ...(seo?.canonicalUrl ? { alternates: { canonical: seo.canonicalUrl } } : {}),
      ...(seo?.noindex ? { robots: { index: false, follow: true } } : {}),
      openGraph: { title: seo?.title ?? name, ...(image ? { images: [image] } : {}) },
    };
  }

  const name = pick(locale, resolved.product.nameTh, resolved.product.nameEn);
  return { title: name, description: resolved.product.description ?? undefined };
}

/**
 * `/products/[key]`: a category, a catalogue product or a stock product — one segment serves
 * all three because Next cannot have two dynamic segments side by side (`paths.ts`).
 */
export default async function ProductKeyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const resolved = await resolveProductKey(key);
  if (!resolved) notFound();

  if (resolved.kind === "category") {
    const query = await searchParams;
    return (
      <CategoryView
        category={resolved.category}
        tree={resolved.tree}
        params={{ type: one(query.type), use: one(query.use), size: one(query.size) }}
        query={readHubParams(query)}
      />
    );
  }
  if (resolved.kind === "product") {
    return <ProductView product={resolved.product} type={resolved.type} category={resolved.category} />;
  }
  return <StockProductView product={resolved.product} />;
}
