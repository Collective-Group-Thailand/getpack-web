/**
 * Where each catalogue thing lives on the storefront — one place, so a link, a sitemap entry,
 * a breadcrumb and a JSON-LD `url` cannot disagree.
 *
 * `/products/[key]` serves both a category and a product (Next cannot have two dynamic
 * segments side by side), resolved in that order: category, catalogue product, stock product.
 * Category codes are the API's `snake_case`; in a URL they read as kebab-case, which is what
 * search engines and people expect of a path.
 */

import { PARAMS } from "@/features/customer/configurator/url-state";

export const categorySegment = (code: string) => code.replaceAll("_", "-");

export const categoryHref = (code: string) => `/products/${categorySegment(code)}`;
export const productHref = (slug: string) => `/products/${slug}`;
export const stockProductHref = (sku: string) => `/products/${encodeURIComponent(sku)}`;
/**
 * The configurator, opened on what the caller already knows (`size`: a standard size's code, `material`,
 * `qty`, …). The parameter names are the configurator's own (`configurator/url-state.ts`).
 */
export const configureHref = (slug: string, query: Partial<Record<keyof typeof PARAMS, string>> = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(PARAMS[key as keyof typeof PARAMS], value);
  const search = params.toString();
  return `/configure/${slug}${search ? `?${search}` : ""}`;
};
export const rfqHref = (categoryCode: string) => `/rfq/${categorySegment(categoryCode)}`;
export const articleHref = (slug: string) => `/articles/${slug}`;

/** Asking for a price on a stock item when its type is quote-only: the stock RFQ, naming the SKU. */
export const stockRfqHref = (sku: string) => `/rfq/standard-product?sku=${encodeURIComponent(sku)}`;
