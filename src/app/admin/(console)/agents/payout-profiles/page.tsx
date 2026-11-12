import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsNav, PayoutProfilesQueue } from "@/features/admin/agents";
import { payoutProfilesList } from "@/features/admin/agents/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.payoutProfiles"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-466: Finance's queue of agents' payout profiles (tax id, address, bank) to verify. */
export default async function PayoutProfilesPage({ searchParams }: Props) {
  const t = await getTranslations("agents.payoutProfiles");
  const initial = await prefetchList(payoutProfilesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <PayoutProfilesQueue initial={initial} />
    </ConsolePage>
  );
}
