import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { ReorderQueue, OrdersNav } from "@/features/admin/orders";
import { reorderSuggestionsList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.reorders"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-424: the reorder suggestion queue (D-288). */
export default async function ReorderQueuePage({ searchParams }: Props) {
  const t = await getTranslations("orders.reorders");
  const initial = await prefetchList(reorderSuggestionsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <OrdersNav />
      <ReorderQueue initial={initial} />
    </ConsolePage>
  );
}
