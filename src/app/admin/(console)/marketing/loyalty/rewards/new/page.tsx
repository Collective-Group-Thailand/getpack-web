import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { RewardItemEditor } from "@/features/admin/marketing/RewardCatalog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.rewards"))("newTitle") };
}

/** A new reward (loyalty P3): saved as a draft with its hidden system promotion; activated from its page. */
export default function NewRewardPage() {
  return (
    <ConsolePage>
      <RewardItemEditor />
    </ConsolePage>
  );
}
