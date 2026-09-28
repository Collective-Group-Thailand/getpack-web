import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { VendorDetail } from "@/features/admin/finance/payables";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.vendors"))("title") };
}

type Props = { params: Promise<{ vendorId: string }> };

/** One vendor: bank accounts, changes and bills. */
export default async function Page({ params }: Props) {
  const { vendorId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <VendorDetail vendorId={vendorId} />
    </ConsolePage>
  );
}
