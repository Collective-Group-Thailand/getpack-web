import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PurchaseOrderDetail } from "@/features/admin/finance/payables";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.purchaseOrders"))("title") };
}

type Props = { params: Promise<{ poId: string }> };

/** One purchase order with its lines and receipts. */
export default async function Page({ params }: Props) {
  const { poId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PurchaseOrderDetail poId={poId} />
    </ConsolePage>
  );
}
