import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ApplicationReview } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.application"))("pageTitle") };
}

type Props = { params: Promise<{ applicationId: string }> };

export default async function ApplicationReviewPage({ params }: Props) {
  const { applicationId } = await params;
  return (
    <ConsolePage>
      <ApplicationReview applicationId={applicationId} />
    </ConsolePage>
  );
}
