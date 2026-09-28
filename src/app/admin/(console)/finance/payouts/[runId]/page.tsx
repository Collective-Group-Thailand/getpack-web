import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PayoutRunDetail } from "@/features/admin/finance/payouts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payouts"))("title") };
}

type Props = { params: Promise<{ runId: string }> };

/** One payout run. */
export default async function Page({ params }: Props) {
  const { runId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PayoutRunDetail runId={runId} />
    </ConsolePage>
  );
}
