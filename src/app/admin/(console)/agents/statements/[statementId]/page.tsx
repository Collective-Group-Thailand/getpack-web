import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatementDetail } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.statement"))("pageTitle") };
}

type Props = { params: Promise<{ statementId: string }> };

export default async function StatementDetailPage({ params }: Props) {
  const { statementId } = await params;
  return (
    <ConsolePage>
      <StatementDetail statementId={statementId} />
    </ConsolePage>
  );
}
