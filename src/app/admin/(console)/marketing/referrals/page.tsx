import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { MarketingNav, ReferralsQueue } from "@/features/admin/marketing";
import { referralsList } from "@/features/admin/marketing/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.referrals"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReferralsPage({ searchParams }: Props) {
  const t = await getTranslations("marketing.referrals");
  const initial = await prefetchList(referralsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <ReferralsQueue initial={initial} />
    </ConsolePage>
  );
}
