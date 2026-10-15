import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatementsList, AgentsNav } from "@/features/admin/agents";
import { statementsList } from "@/features/admin/agents/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.statements"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StatementsPage({ searchParams }: Props) {
  const t = await getTranslations("agents.statements");
  const initial = await prefetchList(statementsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <StatementsList initial={initial} />
    </ConsolePage>
  );
}
