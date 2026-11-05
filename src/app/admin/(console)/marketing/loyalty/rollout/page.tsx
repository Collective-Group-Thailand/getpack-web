import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MarketingNav } from "@/features/admin/marketing";
import { LoyaltyRolloutScreen } from "@/features/admin/marketing/LoyaltyRollout";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.rollout"))("title") };
}

/** The loyalty programme's phased rollout (loyalty P4, D-510): stage, gates, advance / rollback, cohort lookup. */
export default async function LoyaltyRolloutRoute() {
  const t = await getTranslations("marketing.rollout");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <LoyaltyRolloutScreen />
    </ConsolePage>
  );
}
