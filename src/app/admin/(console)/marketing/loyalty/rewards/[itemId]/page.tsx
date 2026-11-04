import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { RewardItemEditor } from "@/features/admin/marketing/RewardCatalog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.rewards"))("itemTitle") };
}

type Props = { params: Promise<{ itemId: string }> };

/** One reward of the catalogue (loyalty P3): edit, activate, pause, archive. */
export default async function RewardPage({ params }: Props) {
  const { itemId } = await params;
  return (
    <ConsolePage>
      <RewardItemEditor itemId={itemId} />
    </ConsolePage>
  );
}
