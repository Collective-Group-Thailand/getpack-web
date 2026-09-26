import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LoyaltySettings, MarketingNav } from "@/features/admin/marketing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.loyalty"))("title") };
}

export default async function LoyaltyPage() {
  const t = await getTranslations("marketing.loyalty");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <LoyaltySettings />
    </ConsolePage>
  );
}
