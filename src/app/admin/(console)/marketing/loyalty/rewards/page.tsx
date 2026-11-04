import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MarketingNav } from "@/features/admin/marketing";
import { RewardCatalog } from "@/features/admin/marketing/RewardCatalog";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.rewards"))("title") };
}

type Props = { searchParams: Promise<{ tab?: string | string[] }> };

/** The reward catalogue (loyalty P3, D-479 / D-498) and its redemptions (`?tab=redemptions`). */
export default async function RewardsPage({ searchParams }: Props) {
  const t = await getTranslations("marketing.rewards");
  const { tab } = await searchParams;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <RewardCatalog tab={tab === "redemptions" ? "redemptions" : "items"} />
    </ConsolePage>
  );
}
