import { cookies, headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { isZone, ZONE_HEADER, type Zone } from "@/lib/zones";

import { loadMessages } from "./messages";
import { LOCALE_COOKIE, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // A `[locale]` segment only exists in the customer zone, so a resolved `requestLocale`
  // already answers both questions and saves the admin/partner lookups below.
  const { locale, zone } = hasLocale(routing.locales, requested)
    ? { locale: requested, zone: "customer" as const }
    : await resolveFromRequest();

  return {
    locale,
    // Every date the API returns is rendered in Bangkok time, wherever the user is
    // (CLAUDE.md); no screen picks its own time zone.
    timeZone: "Asia/Bangkok",
    messages: await loadMessages(locale, zone),
  };
});

/** Admin and partner: zone from the proxy's header, locale from the cookie (th default). */
async function resolveFromRequest(): Promise<{ locale: (typeof routing.locales)[number]; zone: Zone }> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "customer";

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, cookieLocale) ? cookieLocale : routing.defaultLocale;

  return { locale, zone };
}
