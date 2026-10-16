import "server-only";

import { headers } from "next/headers";

import { routing, type Locale } from "@/i18n/routing";
import { PATH_HEADER, ZONE_CONFIG } from "@/lib/zones";

/**
 * Canonical and hreflang URLs for the storefront (F1 1.3 §5).
 *
 * Only the customer zone has any of this: admin and partner are `noindex` and their URLs are
 * tools, not pages (00-master-plan.md §2).
 */

/**
 * The public origin, from the request rather than from configuration.
 *
 * `PUBLIC_HOST` is a *Host header value* and carries no scheme, and the same image serves UAT
 * and production, so hard-coding `https://getpack.co` would emit a canonical pointing at
 * production from every UAT page — which is how a staging site gets itself de-indexed in
 * favour of nothing. `x-forwarded-proto` is what the load balancer sets.
 */
export async function publicOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * The path a locale is served at: Thai at the root, English under `/en`.
 *
 * `localePrefix: "as-needed"` in `src/i18n/routing.ts` is the single source of that rule; this
 * mirrors it for URLs built outside the router, and the test pins the two together.
 */
export function localePath(pathname: string, locale: Locale): string {
  const clean = pathname === "/" ? "" : pathname.replace(/\/+$/, "");
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

/**
 * The path this request is for, without its locale prefix — `/products` for both `/products`
 * and `/en/products`.
 *
 * A layout's `generateMetadata` is not given the pathname, and metadata set in a layout is
 * **inherited by every page under it**. Building the canonical from `"/"` there therefore
 * tells a crawler that every storefront page is the home page, which is considerably worse
 * than having no canonical at all. (It did exactly that until an e2e test caught it.)
 *
 * `x-getpack-path` is the browser's own spelling, stamped by `src/proxy.ts` before any rewrite,
 * which is the only place this is still knowable.
 */
export async function currentPathname(): Promise<string> {
  const raw = (await headers()).get(PATH_HEADER) ?? "/";
  const path = raw.split("?")[0] ?? "/";

  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (path === `/${locale}`) return "/";
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

export interface AlternateUrls {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * `alternates` for a page's metadata: its canonical URL and one entry per locale.
 *
 * `x-default` points at Thai. It is what a crawler serves to a visitor whose language matches
 * neither, and Thailand is where the customers are — the English pages exist for the minority,
 * not as the neutral default.
 */
export function alternateUrls(origin: string, pathname: string, locale: Locale): AlternateUrls {
  const url = (target: Locale) => `${origin}${localePath(pathname, target)}`;

  return {
    canonical: url(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((target) => [target, url(target)])),
      "x-default": url(routing.defaultLocale),
    },
  };
}

/** True when this deployment answers for an indexable zone at all. */
export function isIndexableZone(zone: keyof typeof ZONE_CONFIG): boolean {
  return ZONE_CONFIG[zone].indexable;
}
