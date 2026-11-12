import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentPage } from "@/features/agent/AgentPage";
import { getPlaybook } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { PlaybookLibrary } from "@/features/agent/playbook/PlaybookLibrary";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.titles");
  return { title: t("playbook") };
}

/** คู่มือการขาย (D-468 §5): the published cards for agents — reached from the sidebar and the profile menu. */
export default async function Page() {
  await requireActiveAgent();
  const [t, tz, cards] = await Promise.all([
    getTranslations("agentSales.playbook"),
    getTranslations("agentZone.titles"),
    getPlaybook(),
  ]);
  return (
    <AgentPage title={tz("playbook")} intro={t("intro")}>
      <PlaybookLibrary cards={cards} />
    </AgentPage>
  );
}
