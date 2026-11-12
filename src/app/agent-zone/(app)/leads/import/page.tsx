import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentPage } from "@/features/agent/AgentPage";
import { requireActiveAgent } from "@/features/agent/context.server";
import { ImportLeads } from "@/features/agent/pipeline/ImportLeads";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentSales.import");
  return { title: t("title") };
}

/** Importing leads from a CSV (D-468 §1): up to 500 rows, a dry run first, then the commit. */
export default async function Page() {
  await requireActiveAgent();
  const [t, tz] = await Promise.all([getTranslations("agentSales.import"), getTranslations("agentZone.titles")]);
  return (
    <AgentPage title={t("title")} intro={t("intro")} back={{ href: "/leads", label: tz("leads") }}>
      <ImportLeads maxRows={500} />
    </AgentPage>
  );
}
