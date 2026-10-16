import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { CallOffsList, OrdersNav } from "@/features/admin/orders";
import { callOffsList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.callOffs"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-424: call-off agreements (D-290). */
export default async function CallOffsListPage({ searchParams }: Props) {
  const t = await getTranslations("orders.callOffs");
  const initial = await prefetchList(callOffsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <OrdersNav />
      <CallOffsList initial={initial} />
    </ConsolePage>
  );
}
