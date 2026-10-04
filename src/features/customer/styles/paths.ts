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

/** The style code a slug names (`PK-TE-01`), or `null`. */
export function codeOfSlug(slug: string): string | null {
  const match = CODE.exec(decodeURIComponent(slug));
  return match ? match[1].toUpperCase() : null;
}

export const compareHref = (codes: readonly string[]) =>
  codes.length ? `/styles/compare?codes=${codes.map(encodeURIComponent).join(",")}` : "/styles/compare";
