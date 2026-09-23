import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { BRAND_COMPANY, BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";
import { fontClassNames } from "@/ui/fonts";
import { ThemeProvider } from "@/ui/theme";
import { readThemeChoice } from "@/ui/theme/server";
import { dataThemeAttribute } from "@/ui/theme/themes";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    template: `%s — ${BRAND_NAME}`,
  },
  description: "ออกแบบกล่องบรรจุภัณฑ์ตามขนาดจริง พร้อมไฟล์ไดคัทสำหรับโรงพิมพ์",
  applicationName: BRAND_NAME,
  authors: [{ name: BRAND_COMPANY }],
};

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
        <NextIntlClientProvider>
          <ThemeProvider initialChoice={themeChoice} zone="customer">
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
