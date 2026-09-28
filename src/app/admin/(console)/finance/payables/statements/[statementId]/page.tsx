import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { BillingStatementDetail } from "@/features/admin/finance/payables";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.statements"))("title") };
}

type Props = { params: Promise<{ statementId: string }> };

/** One billing statement and its tax invoices. */
export default async function Page({ params }: Props) {
  const { statementId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <BillingStatementDetail statementId={statementId} />
    </ConsolePage>
  );
}
