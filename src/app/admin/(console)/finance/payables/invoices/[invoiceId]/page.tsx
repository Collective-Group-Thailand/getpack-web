import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { VendorInvoiceDetail } from "@/features/admin/finance/payables";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.invoices"))("title") };
}

type Props = { params: Promise<{ invoiceId: string }> };

/** One tax invoice or bill, checked against the vendor record. */
export default async function Page({ params }: Props) {
  const { invoiceId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <VendorInvoiceDetail invoiceId={invoiceId} />
    </ConsolePage>
  );
}
