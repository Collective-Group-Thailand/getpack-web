import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsNav, PlansList } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.plans"))("title") };
}

export default async function AgentPlansPage() {
  const t = await getTranslations("agents.plans");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <PlansList />
    </ConsolePage>
  );
}
