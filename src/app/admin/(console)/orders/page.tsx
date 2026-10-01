import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { OrdersList } from "@/features/admin/orders";
import { ALL_ORDERS, allOrdersList, ordersList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: Props) {
  const t = await getTranslations("orders.list");
  const params = await searchParams;
  // `?queue=all` is every order (`admin.orders.list`); any other value is one of the queues.
  const initial =
    params.queue === ALL_ORDERS
      ? ({ view: "all", page: await prefetchList(allOrdersList, params) } as const)
      : ({ view: "queue", page: await prefetchList(ordersList, params) } as const);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <OrdersList initial={initial} />
    </ConsolePage>
  );
}
