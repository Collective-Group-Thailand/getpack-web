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
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return {
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
    <html lang={locale} data-theme={dataThemeAttribute(themeChoice)} className={fontClassNames}>
      <body>
        <ZoneProviders zone="customer" themeChoice={themeChoice}>
          {children}
        </ZoneProviders>
      </body>
    </html>
  );
}
