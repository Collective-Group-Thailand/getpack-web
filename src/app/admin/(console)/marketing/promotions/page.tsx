import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { MarketingNav, PromotionsList } from "@/features/admin/marketing";
import { CapacityDealList } from "@/features/admin/marketing/CapacityDeals";
import { promotionsList } from "@/features/admin/marketing/resources";
import { PageHeader } from "@/ui/components/PageHeader";
import { ViewTabs } from "@/ui/components/ViewTabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.promotions"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Promotions, and (loyalty P3, D-502) the capacity-deal drafts as their own view: `?origin=capacity_deal` lists them
 * with their `capacity_deal_publish` approval; every other view is the promotions list as before.
 */
export default async function PromotionsPage({ searchParams }: Props) {
  const t = await getTranslations("marketing.promotions");
  const params = await searchParams;
  const capacity = params.origin === "capacity_deal";
  const initial = capacity ? null : await prefetchList(promotionsList, params);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <ViewTabs
        label={t("views.label")}
        current={capacity ? "capacity" : "all"}
        items={[
          { key: "all", href: "/marketing/promotions", label: t("views.all") },
          { key: "capacity", href: "/marketing/promotions?origin=capacity_deal", label: t("views.capacity") },
        ]}
      />
      {capacity ? <CapacityDealList /> : <PromotionsList initial={initial} />}
    </ConsolePage>
  );
}
