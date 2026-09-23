import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Every date the API returns is rendered in Bangkok time, wherever the user is
    // (CLAUDE.md); no screen picks its own time zone.
    timeZone: "Asia/Bangkok",
    messages: await loadMessages(locale),
  };
});
