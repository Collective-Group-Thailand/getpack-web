import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RecommendationDetail } from "@/features/admin/advisor";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("advisor.detail"))("pageTitle") };
}

type Props = { params: Promise<{ recommendationId: string }> };

export default async function RecommendationPage({ params }: Props) {
  const { recommendationId } = await params;
  return (
    <ConsolePage>
      <RecommendationDetail recommendationId={recommendationId} />
    </ConsolePage>
  );
}
