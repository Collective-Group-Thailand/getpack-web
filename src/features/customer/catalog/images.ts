/**
 * Where the browser fetches a catalogue image from.
 *
 * The API returns image paths on its own origin (`/v1/store/catalog/images/{fileId}`), which a
 * browser cannot reach — the API is internal (ADR-0005). The storefront BFF forwards
 * `/v1/store/*`, so the same path under `/bff` is served through it. An absolute URL (a CDN,
 * once there is one) is used as it is.
 */
export function storeImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return url.startsWith("/v1/store/") ? `/bff${url}` : null;
}

/** The same image as an absolute URL, for structured data and Open Graph. */
export function absoluteImageUrl(origin: string, url: string | null | undefined): string | null {
  const src = storeImageSrc(url);
  if (!src) return null;
  return src.startsWith("/") ? `${origin}${src}` : src;
}

/**
 * What `catalog:product-photos` (getpack-api, D-426) writes to a product image's `variant`: the
 * photo's alt text in both languages and where it came from — `ai-render` for an AI-rendered
 * reference photo, which the product page says so.
 */
export interface PhotoVariant {
  alt: { th: string; en?: string };
  source: string;
}

export function photoVariant(variant: unknown): PhotoVariant | null {
  if (!variant || typeof variant !== "object") return null;
  const v = variant as { kind?: unknown; source?: unknown; alt?: { th?: unknown; en?: unknown } };
  if (v.kind !== "photo" || typeof v.source !== "string" || typeof v.alt?.th !== "string") return null;
  return { alt: { th: v.alt.th, ...(typeof v.alt.en === "string" ? { en: v.alt.en } : {}) }, source: v.source };
}

/** An AI-rendered reference photo, not a photograph of a made box: the page labels it. */
export const isRendered = (variant: unknown): boolean => photoVariant(variant)?.source === "ai-render";
