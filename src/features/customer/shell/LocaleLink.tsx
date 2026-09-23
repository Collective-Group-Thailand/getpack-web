"use client";

import { useParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";

/**
 * The storefront's language switcher.
 *
 * Unlike the admin and partner zones, the customer locale **is** the URL — Thai at `/`,
 * English at `/en` (00-master-plan.md §2) — because those pages are indexed and a cookie is
 * invisible to a crawler. So switching is a navigation, not a cookie write, and it must land
 * on the *same* page in the other language rather than the home page.
 *
 * `next-intl`'s `Link` does the rewriting, given the current pathname without its locale
 * prefix, which `usePathname` from `@/i18n/navigation` already returns.
 */
export function LocaleLink() {
  const t = useTranslations("common.locale");
  const current = useLocale();
  const pathname = usePathname();
  // Dynamic segments have to be handed back to `Link` or it cannot rebuild the href.
  const params = useParams();

  return (
    <DropdownMenu
      align="end"
      label={t("label")}
      trigger={<IconButton name="language" variant="ghost" size="sm" label={t("label")} />}
      items={routing.locales.map((locale) => ({
        id: locale,
        selected: locale === current,
        label: (
          <Link
            // `params` is `Record<string, string | string[]>`; next-intl's typed href wants
            // exactly the params of the current route, which it cannot know from here.
            href={{ pathname, params } as never}
            locale={locale as Locale}
            // `hrefLang` tells a crawler these two URLs are the same page in another
            // language — the other half of the hreflang tags in `src/lib/seo`.
            hrefLang={locale}
            className="block w-full"
          >
            {t(locale)}
          </Link>
        ),
      }))}
    />
  );
}
