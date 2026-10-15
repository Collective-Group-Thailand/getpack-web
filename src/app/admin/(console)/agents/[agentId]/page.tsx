import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentDetail } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.agent"))("pageTitle") };
}

type Props = { params: Promise<{ agentId: string }> };

export default async function AgentDetailPage({ params }: Props) {
  const { agentId } = await params;
  return (
    <ConsolePage>
      <AgentDetail agentId={agentId} />
    </ConsolePage>
  );
}
