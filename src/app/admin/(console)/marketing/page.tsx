import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { CampaignsList, MarketingNav } from "@/features/admin/marketing";
import { campaignsList } from "@/features/admin/marketing/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  // The page carries the menu's name (UX audit: the menu said "การตลาด", the page "แคมเปญ").
  return { title: (await getTranslations("marketing"))("hubTitle") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MarketingPage({ searchParams }: Props) {
  const [t, tMarketing] = await Promise.all([getTranslations("marketing.campaigns"), getTranslations("marketing")]);
  const initial = await prefetchList(campaignsList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={tMarketing("hubTitle")} description={t("description")} />
      <MarketingNav />
      <CampaignsList initial={initial} />
    </ConsolePage>
  );
}
