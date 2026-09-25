import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { OrdersList } from "@/features/admin/orders";
import { ordersList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: Props) {
  const t = await getTranslations("orders.list");
  const initial = await prefetchList(ordersList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <OrdersList initial={initial} />
    </ConsolePage>
  );
}
