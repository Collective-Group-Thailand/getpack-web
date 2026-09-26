import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CampaignDetail } from "@/features/admin/marketing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.campaign"))("pageTitle") };
}

type Props = { params: Promise<{ campaignId: string }> };

export default async function CampaignPage({ params }: Props) {
  const { campaignId } = await params;
  return (
    <ConsolePage>
      <CampaignDetail campaignId={campaignId} />
    </ConsolePage>
  );
}
