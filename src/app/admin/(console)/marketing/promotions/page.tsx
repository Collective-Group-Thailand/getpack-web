import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { MarketingNav, PromotionsList } from "@/features/admin/marketing";
import { promotionsList } from "@/features/admin/marketing/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.promotions"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PromotionsPage({ searchParams }: Props) {
  const t = await getTranslations("marketing.promotions");
  const initial = await prefetchList(promotionsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <PromotionsList initial={initial} />
    </ConsolePage>
  );
}
