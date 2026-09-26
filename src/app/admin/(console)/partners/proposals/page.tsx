import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PartnersNav, ProposalsList } from "@/features/admin/partners";
import { proposalsList } from "@/features/admin/partners/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.proposals"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProposalsPage({ searchParams }: Props) {
  const t = await getTranslations("partners.proposals");
  const initial = await prefetchList(proposalsList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <ProposalsList initial={initial} />
    </ConsolePage>
  );
}
