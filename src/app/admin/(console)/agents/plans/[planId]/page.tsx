import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PlanDetail } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.plan"))("pageTitle") };
}

type Props = { params: Promise<{ planId: string }> };

export default async function PlanDetailPage({ params }: Props) {
  const { planId } = await params;
  return (
    <ConsolePage>
      <PlanDetail planId={planId} />
    </ConsolePage>
  );
}
