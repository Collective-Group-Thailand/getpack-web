import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "BoxStudio — ออกแบบบรรจุภัณฑ์ออนไลน์",
  description: "ออกแบบกล่องบรรจุภัณฑ์ตามขนาดจริง พร้อมไฟล์ไดคัทสำหรับโรงพิมพ์",
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

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Sarabun:ital,wght@0,400;0,700;1,400;1,700&family=Prompt:ital,wght@0,400;0,700;1,400;1,700&family=Kanit:ital,wght@0,400;0,700;1,400;1,700&display=swap"
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
