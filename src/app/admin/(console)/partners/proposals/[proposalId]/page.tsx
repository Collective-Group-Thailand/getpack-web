import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ProposalReview } from "@/features/admin/partners";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.review"))("pageTitle") };
}

type Props = { params: Promise<{ proposalId: string }> };

export default async function ProposalPage({ params }: Props) {
  const { proposalId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ProposalReview proposalId={proposalId} />
    </ConsolePage>
  );
}
