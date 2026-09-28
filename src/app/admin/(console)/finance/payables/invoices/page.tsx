import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { VendorInvoicesList, PayablesNav } from "@/features/admin/finance/payables";
import { vendorInvoicesList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.invoices"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Factory tax invoices and other vendors' bills (§2). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payables.invoices");
  const initial = await prefetchList(vendorInvoicesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <VendorInvoicesList initial={initial} />
    </ConsolePage>
  );
}
