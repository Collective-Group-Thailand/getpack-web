import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ClaimDetail } from "@/features/admin/logistics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("logistics.claim"))("pageTitle") };
}

type Props = { params: Promise<{ claimId: string }> };

export default async function ClaimPage({ params }: Props) {
  const { claimId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ClaimDetail claimId={claimId} />
    </ConsolePage>
  );
}
