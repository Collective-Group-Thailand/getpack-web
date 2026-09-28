import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PurchaseOrdersList, PayablesNav } from "@/features/admin/finance/payables";
import { purchaseOrdersList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.purchaseOrders"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Factory purchase orders (§6). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payables.purchaseOrders");
  const initial = await prefetchList(purchaseOrdersList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <PurchaseOrdersList initial={initial} />
    </ConsolePage>
  );
}
