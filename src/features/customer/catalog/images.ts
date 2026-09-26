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
