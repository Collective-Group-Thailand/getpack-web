/**
 * Where a style lives on the storefront (U3.5 §5): one indexable page per base structure, at its
 * code followed by its name in the page's language — `/styles/pk-te-01-tuck-end-carton…` in
 * English, `/th/styles/pk-te-01-กล่องฝาเสียบ…` in Thai — so a link reads as what it is. Only the
 * code decides which style a URL shows; a stale or foreign name is redirected to the right one.
 * Sizes are never in a URL (no thin pages per size).
 */

const CODE = /^(pk-[a-z]+-\d+)(?:-|$)/i;

/** A name as a path segment: letters and digits of any script, joined by hyphens. */
export function slugify(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const styleSlug = (code: string, name: string) => [code.toLowerCase(), slugify(name)].filter(Boolean).join("-");

/** Percent-encoded: a Thai name is valid in a link but not in a redirect's `Location` header. */
export const styleHref = (code: string, name: string) => `/styles/${encodeURIComponent(styleSlug(code, name))}`;

export const STYLES_HREF = "/styles";

/**
 * The fragment that opens /styles on its "ค้นหาด้วยขนาดสินค้า" tab (the existing size search). The product page's
 * "หาเบอร์จากขนาดสินค้า" links here (owner 2026-10-28 14:36, DECISIONS-STAGE-A §14.9) — no product-scoped finder.
 */
export const SIZE_SEARCH_FRAGMENT = "size-search";
export const SIZE_SEARCH_HREF = `${STYLES_HREF}#${SIZE_SEARCH_FRAGMENT}`;

/** The fragment a style page opens its free-dieline form at — where signing in for it returns to (T12). */
export const DIELINE_FRAGMENT = "dieline";

/** The style code a slug names (`PK-TE-01`), or `null`. */
export function codeOfSlug(slug: string): string | null {
  const match = CODE.exec(decodeURIComponent(slug));
  return match ? match[1].toUpperCase() : null;
}

export const compareHref = (codes: readonly string[]) =>
  codes.length ? `/styles/compare?codes=${codes.map(encodeURIComponent).join(",")}` : "/styles/compare";

/**
 * The quotation request for one variant (D-407): the RFQ form of the style's product type
 * (`/rfq/<category>?type=<productType>`), with the base and the variant code added — or the
 * contact page when the style has no form yet.
 */
export function variantRfqHref(rfqHref: string | null, base: string, code: string): string {
  if (!rfqHref) return "/contact";
  const [path, query = ""] = rfqHref.split("?");
  const params = new URLSearchParams(query);
  params.set("base", base);
  params.set("style", code);
  return `${path}?${params.toString()}`;
}

/** A feature's page across the library (D-410): "กล่องมีหน้าต่าง" — every style that offers it. */
export const topicHubHref = (topic: string) => `/styles/options/${topic}`;

/** A product's page (D-410): "กล่องสบู่" — the styles that suit it. */
export const forUseCaseHref = (useCase: string) => `/styles/for/${useCase}`;

/** One style's page for one feature (D-410): "กล่องฝาเสียบมีหน้าต่าง". */
export const styleTopicHref = (code: string, name: string, topic: string) => `${styleHref(code, name)}/${topic}`;

/** Where a variant's drawn dieline is served as an image (D-410): options as `axis=value`, sets joined by `+`. */
export function previewSrc(base: string, options: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [axis, value] of Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))
    search.set(axis, Array.isArray(value) ? [...value].map(String).sort().join("+") || "none" : String(value));
  return `/style-previews/${encodeURIComponent(base)}?${search.toString()}`;
}
