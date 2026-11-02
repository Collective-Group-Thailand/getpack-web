import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TaxDeclarationReview } from "@/features/admin/agents";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.taxDeclarations"))("title") };
}

type Props = { params: Promise<{ declarationId: string }> };

export default async function TaxDeclarationReviewPage({ params }: Props) {
  const { declarationId } = await params;
  return (
    <ConsolePage>
      <TaxDeclarationReview declarationId={declarationId} />
    </ConsolePage>
  );
}
