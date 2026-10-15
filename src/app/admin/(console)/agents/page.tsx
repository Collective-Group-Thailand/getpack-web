import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsList, AgentsNav } from "@/features/admin/agents";
import { agentsList } from "@/features/admin/agents/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AgentsPage({ searchParams }: Props) {
  const t = await getTranslations("agents.list");
  const initial = await prefetchList(agentsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <AgentsList initial={initial} />
    </ConsolePage>
  );
}
