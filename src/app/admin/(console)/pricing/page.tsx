import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PricingHome, PricingNav } from "@/features/admin/pricing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing.nav"))("title") };
}

export default async function PricingPage() {
  const t = await getTranslations("pricing.nav");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PricingNav />
      <PricingHome />
    </ConsolePage>
  );
}
