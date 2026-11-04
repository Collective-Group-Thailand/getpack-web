import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MarketingNav } from "@/features/admin/marketing";
import { LoyaltyCampaigns } from "@/features/admin/marketing/LoyaltyCampaigns";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.loyaltyCampaigns"))("pageTitle") };
}

/** Points campaigns (loyalty P2 list, P3 admin rules, D-499): create, edit before start, cancel. */
export default async function LoyaltyCampaignsPage() {
  const t = await getTranslations("marketing.loyaltyCampaigns");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <MarketingNav />
      <LoyaltyCampaigns />
    </ConsolePage>
  );
}
