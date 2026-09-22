import { defineRouting } from "next-intl/routing";

/**
 * Customer zone only. Thai is the default and carries no prefix (`/design/new`),
 * English lives under `/en`. The admin and partner zones are Thai-only and are added
 * in F1, together with the host -> zone mapping in src/proxy.ts.
 */
export const routing = defineRouting({
  locales: ["th", "en"],
  defaultLocale: "th",
  localePrefix: "as-needed",
  // `/` is always Thai. With detection on, next-intl would remember a visitor's last
  // locale in a cookie and serve English from `/`, which breaks the indexed th-at-root /
  // en-at-/en split in 00-master-plan.md section 2 and makes the page uncacheable.
  // A language switcher that navigates to /en is added with the shell in F1.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
