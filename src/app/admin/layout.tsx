import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ZoneProviders } from "@/features/shared/zone";
import { BRAND_NAME } from "@/ui/brand";
import { fontClassNames } from "@/ui/fonts";
import { readThemeChoice } from "@/ui/theme/server";
import { dataThemeAttribute } from "@/ui/theme/themes";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");

  return {
    title: { default: `${BRAND_NAME} — ${t("zone")}`, template: `%s — ${BRAND_NAME}` },
    // Belt and braces behind the proxy's `X-Robots-Tag` (00-master-plan.md §2): this zone
    // is never indexed, whatever a crawler reaches it through.
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * Admin zone root layout. There is no `src/app/layout.tsx`: each zone gets its own
 * `<html>`, providers, theme and fonts, so admin code never ships to customers
 * (00-master-plan.md §2).
 *
 * The URL never carries a locale here — these screens are tools, not indexed pages — so the
 * language comes from the `pk_locale` cookie through `src/i18n/request.ts`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // Stamped before the first byte, so the page never paints in the wrong theme (ADR-0003).
  const themeChoice = await readThemeChoice("admin");

  return (
    <html lang={locale} data-theme={dataThemeAttribute(themeChoice)} className={fontClassNames}>
      <body>
        <ZoneProviders zone="admin" themeChoice={themeChoice}>
          {children}
        </ZoneProviders>
      </body>
    </html>
  );
}
