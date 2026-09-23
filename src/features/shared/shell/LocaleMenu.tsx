"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, routing, type Locale } from "@/i18n/routing";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";

/**
 * The language switcher for the **admin and partner** zones, where the locale lives in the
 * `pk_locale` cookie rather than the URL (00-master-plan.md §2: those URLs are tools, not
 * indexed pages).
 *
 * The customer zone has its own, in `src/features/customer/shell`, because there the locale
 * *is* the URL — `/` for Thai and `/en` for English — and switching means navigating. Two
 * mechanisms, two components: one component with a branch would need to know which zone it
 * was in, which is exactly the coupling the zone split exists to avoid.
 */
export function LocaleMenu() {
  const t = useTranslations("common.locale");
  const current = useLocale();
  const router = useRouter();

  const choose = useCallback(
    (locale: Locale) => {
      if (locale === current) return;

      // Written from the browser, like `pk_theme`: the cookie carries no identity, so it
      // needs no round trip to set. `refresh()` then re-renders the server tree, which is
      // where `src/i18n/request.ts` reads it — a client-side state flip would leave every
      // server component still in the old language.
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${
        window.location.protocol === "https:" ? "; secure" : ""
      }`;
      router.refresh();
    },
    [current, router],
  );

  return (
    <DropdownMenu
      align="end"
      label={t("label")}
      trigger={<IconButton name="language" variant="ghost" size="sm" label={t("label")} />}
      items={routing.locales.map((locale) => ({
        id: locale,
        label: t(locale),
        selected: locale === current,
        onSelect: () => choose(locale),
      }))}
    />
  );
}
