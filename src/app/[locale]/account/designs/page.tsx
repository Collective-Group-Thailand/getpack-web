import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/features/customer/shell";

import MyDesigns from "./MyDesigns";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("designs");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <MyDesigns />
      <SiteFooter />
    </>
  );
}
