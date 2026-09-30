import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { OrderDetail } from "@/features/admin/orders";
import { ORDER_TABS, type OrderTab } from "@/features/admin/orders/tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.detail"))("title") };
}

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const tab = (ORDER_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as OrderTab) : "summary";
  let initial = null;
  try {
    const { contract } = await adminServerApis();
    initial = (await contract.GET("/v1/admin/orders/{orderId}", { params: { path: { orderId } } })).data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <OrderDetail orderId={orderId} initial={initial} tab={tab} />
    </ConsolePage>
  );
}
