import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsNav, TaxDeclarationsQueue } from "@/features/admin/agents";
import { taxDeclarationsList } from "@/features/admin/agents/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.taxDeclarations"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-465: Finance's queue of agents' ล.ย.01 allowance declarations. */
export default async function TaxDeclarationsPage({ searchParams }: Props) {
  const t = await getTranslations("agents.taxDeclarations");
  const initial = await prefetchList(taxDeclarationsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <TaxDeclarationsQueue initial={initial} />
    </ConsolePage>
  );
}
