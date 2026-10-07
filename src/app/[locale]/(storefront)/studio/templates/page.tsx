import { permanentRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { STYLES_HREF } from "@/features/customer/styles/paths";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * `/studio/templates` — the header's "แบบกล่อง" (Phase 4 §4.1). The template library is the style
 * library (U3.5), whose indexed address stays `/styles`; this path sends the visitor there, with any
 * filter they carried.
 */
export default async function StudioTemplates({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, search] = await Promise.all([getLocale(), searchParams]);
  const query = new URLSearchParams(
    Object.entries(search).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((one) => [key, one]),
    ),
  ).toString();
  const path = getPathname({ href: STYLES_HREF, locale: locale as Locale });
  permanentRedirect(query ? `${path}?${query}` : path);
}
