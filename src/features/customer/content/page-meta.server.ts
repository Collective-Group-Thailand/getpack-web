import "server-only";

import { getLocale, getTranslations } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { breadcrumbSchema, localePath, publicOrigin, type Crumb } from "@/lib/seo";

/**
 * What every written page needs for its frame and structured data: the origin, the locale, the
 * page's own absolute URL, and its breadcrumb (home → page) in both forms — for the nav and for
 * `BreadcrumbList`.
 */
export async function pageContext(pathname: string, pageName: string) {
  const [origin, rawLocale, tCatalog] = await Promise.all([
    publicOrigin(),
    getLocale(),
    getTranslations("catalog.breadcrumbs"),
  ]);
  const locale = (routing.locales as readonly string[]).includes(rawLocale) ? (rawLocale as Locale) : routing.defaultLocale;
  const url = `${origin}${localePath(pathname, locale)}`;
  const crumbs: Crumb[] = [{ name: tCatalog("home"), url: `${origin}${localePath("/", locale)}` }, { name: pageName }];
  return {
    origin,
    locale,
    url,
    crumbs,
    crumbLabel: tCatalog("label"),
    breadcrumb: breadcrumbSchema(crumbs),
    /** The BCP-47 tag structured data wants (`th`, `en`). */
    language: locale,
  };
}
