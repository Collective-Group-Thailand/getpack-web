import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PayoutProfileReview } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.payoutProfiles"))("title") };
}

type Props = { params: Promise<{ payoutProfileId: string }> };

export default async function PayoutProfileReviewPage({ params }: Props) {
  const { payoutProfileId } = await params;
  return (
    <ConsolePage>
      <PayoutProfileReview payoutProfileId={payoutProfileId} />
    </ConsolePage>
  );
}
