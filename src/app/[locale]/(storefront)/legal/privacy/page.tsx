import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/features/customer/content/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.legal.privacy");
  return { title: t("title"), description: t("metaDescription") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage pageKey="privacy" pathname="/legal/privacy" />;
}
