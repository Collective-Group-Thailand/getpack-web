import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ShipmentDetail } from "@/features/admin/logistics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("logistics.shipment"))("pageTitle") };
}

type Props = { params: Promise<{ shipmentId: string }> };

export default async function ShipmentPage({ params }: Props) {
  const { shipmentId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ShipmentDetail shipmentId={shipmentId} />
    </ConsolePage>
  );
}
