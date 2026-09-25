import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { ShipmentsList } from "@/features/admin/logistics";
import { shipmentsList } from "@/features/admin/logistics/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("logistics.shipments"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShipmentsPage({ searchParams }: Props) {
  const t = await getTranslations("logistics.shipments");
  const initial = await prefetchList(shipmentsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ShipmentsList initial={initial} />
    </ConsolePage>
  );
}
