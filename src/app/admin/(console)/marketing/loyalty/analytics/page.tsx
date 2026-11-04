import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LoyaltyAnalytics, MarketingNav } from "@/features/admin/marketing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.analytics"))("title") };
}

/** Loyalty analytics (loyalty P2, PLAN §6): liability, movement, breakage, earn vs redeem and retention. */
export default async function LoyaltyAnalyticsPage() {
  const t = await getTranslations("marketing.analytics");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <LoyaltyAnalytics />
    </ConsolePage>
  );
}
