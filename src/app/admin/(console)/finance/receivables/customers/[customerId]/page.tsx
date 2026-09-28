import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PartyBalance } from "@/features/admin/finance/receivables";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.receivables.party"))("title") };
}

type Props = { params: Promise<{ customerId: string }> };

/** One customer's (or company's) balance. */
export default async function Page({ params }: Props) {
  const { customerId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PartyBalance customerId={customerId} />
    </ConsolePage>
  );
}
