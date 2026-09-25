import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { OrderGroup } from "@/features/admin/orders";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.group"))("title") };
}

export default async function OrderGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <ConsolePage>
      <OrderGroup groupId={groupId} />
    </ConsolePage>
  );
}
