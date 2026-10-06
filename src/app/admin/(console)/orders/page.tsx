import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { OrdersList } from "@/features/admin/orders";
import { ALL_ORDERS, allOrdersList, ordersList } from "@/features/admin/orders/resources";
import { can, getActor } from "@/lib/auth/actor";
import { Button } from "@/ui/components/Button";
import { StyleWorkLinks } from "@/features/admin/structural/StyleWorkLinks";
import { PageHeader } from "@/ui/components/PageHeader";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: Props) {
  const [t, tSamples, actor] = await Promise.all([
    getTranslations("orders.list"),
    getTranslations("orders.samples"),
    getActor("admin"),
  ]);
  const params = await searchParams;
  // `?queue=all` is every order (`admin.orders.list`); any other value is one of the queues.
  const initial =
    params.queue === ALL_ORDERS
      ? ({ view: "all", page: await prefetchList(allOrdersList, params) } as const)
      : ({ view: "queue", page: await prefetchList(ordersList, params) } as const);
  return (
    <ConsolePage>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          // The sample queue (U2.F3): packio-api's menu has no entry for it yet (CONTRACT-REQUEST admin.menu-samples).
          <span className="flex flex-wrap gap-2">
            {can(actor, "samples.read") ? (
              <Button asChild variant="secondary" iconStart="package-check">
                <Link href="/samples">{tSamples("link")}</Link>
              </Button>
            ) : null}
            {/* Structural design requests and dieline offers (U3.6): no menu entry yet either. */}
            <StyleWorkLinks />
          </span>
        }
      />
      <OrdersList initial={initial} />
    </ConsolePage>
  );
}
