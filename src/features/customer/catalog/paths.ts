/**
 * Where each catalogue thing lives on the storefront — one place, so a link, a sitemap entry,
 * a breadcrumb and a JSON-LD `url` cannot disagree.
 *
 * `/products/[key]` serves both a category and a product (Next cannot have two dynamic
 * segments side by side), resolved in that order: category, catalogue product, stock product.
 * Category codes are the API's `snake_case`; in a URL they read as kebab-case, which is what
 * search engines and people expect of a path.
 */

export const categorySegment = (code: string) => code.replaceAll("_", "-");

export const categoryHref = (code: string) => `/products/${categorySegment(code)}`;
export const productHref = (slug: string) => `/products/${slug}`;
export const stockProductHref = (sku: string) => `/products/${encodeURIComponent(sku)}`;
export const configureHref = (slug: string) => `/configure/${slug}`;
export const rfqHref = (categoryCode: string) => `/rfq/${categorySegment(categoryCode)}`;
export const articleHref = (slug: string) => `/articles/${slug}`;
