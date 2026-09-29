import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ZoneProviders } from "@/features/shared/zone";
import { BRAND_COMPANY, BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";
import { fontClassNames } from "@/ui/fonts";
import { readThemeChoice } from "@/ui/theme/server";
import { dataThemeAttribute } from "@/ui/theme/themes";
import { routing } from "@/i18n/routing";
import { alternateUrls, currentPathname, publicOrigin } from "@/lib/seo";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, origin, pathname] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    publicOrigin(),
    currentPathname(),
  ]);

  return {
    /*
     * The base for every relative URL Next resolves in metadata, taken from the request so a
     * UAT page never advertises a production canonical.
     *
     * The canonical is built from the *request* path, not from `"/"`. Metadata set in a
     * layout is inherited by every page beneath it, so a fixed root canonical here would
     * claim that every storefront page is the home page. A page with something more specific
     * to say still overrides `alternates` in its own `generateMetadata`.
     */
    metadataBase: new URL(origin),
    alternates: alternateUrls(origin, pathname, hasLocale(routing.locales, locale) ? locale : routing.defaultLocale),
    title: {
      default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      template: `%s — ${BRAND_NAME}`,
    },
    // Copy, so it comes from src/i18n rather than being hard-coded in a layout.
    description: t("meta.description"),
    applicationName: BRAND_NAME,
    authors: [{ name: BRAND_COMPANY }],
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Customer zone root layout. There is deliberately no src/app/layout.tsx: each zone gets
 * its own <html>, providers, theme and fonts, so admin and partner code never ships to
 * customers (00-master-plan.md section 2).
 */
export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Stamped before the first byte, so the page never paints in the wrong theme (ADR-0003).
  const themeChoice = await readThemeChoice("customer");

  return (
    <html lang={locale} data-theme={dataThemeAttribute(themeChoice)} data-zone="customer" className={fontClassNames}>
      <body>
        <ZoneProviders zone="customer" themeChoice={themeChoice}>
          {children}
        </ZoneProviders>
      </body>
    </html>
  );
}
