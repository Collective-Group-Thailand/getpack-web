/**
 * Where the browser fetches a catalogue image from.
 *
 * The API returns image paths on its own origin (`/v1/store/catalog/images/{fileId}`), which a
 * browser cannot reach — the API is internal (ADR-0005). The storefront BFF forwards
 * `/v1/store/*`, so the same path under `/bff` is served through it. An absolute URL (a CDN,
 * once there is one) is used as it is.
 */
export function storeImageSrc(url: string | null | undefined, size: "full" | "thumb" = "full"): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/v1/store/")) return null;
  // A card draws the API's 400 px WebP thumbnail (`store.catalog.getImage?size=thumb`, a tenth of the
  // bytes); galleries and anything shown large keep the original.
  return `/bff${url}${size === "thumb" && url.startsWith("/v1/store/catalog/images/") ? "?size=thumb" : ""}`;
}

/** The same image as an absolute URL, for structured data and Open Graph. */
export function absoluteImageUrl(origin: string, url: string | null | undefined): string | null {
  const src = storeImageSrc(url);
  if (!src) return null;
  return src.startsWith("/") ? `${origin}${src}` : src;
}

/**
 * What a product image's `variant` says the photo shows (D-426): its alt text in both languages.
 * Where the photo came from is the admin's business — the API does not send it to the storefront.
 */
export interface PhotoVariant {
  alt: { th: string; en?: string };
}

export function photoVariant(variant: unknown): PhotoVariant | null {
  if (!variant || typeof variant !== "object") return null;
  const v = variant as { kind?: unknown; alt?: { th?: unknown; en?: unknown } };
  if (v.kind !== "photo" || typeof v.alt?.th !== "string") return null;
  return { alt: { th: v.alt.th, ...(typeof v.alt.en === "string" ? { en: v.alt.en } : {}) } };
}
