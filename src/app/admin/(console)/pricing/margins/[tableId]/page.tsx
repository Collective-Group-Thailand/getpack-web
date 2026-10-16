import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { SellMarginDetail } from "@/features/admin/pricing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing.margin"))("pageTitle") };
}

type Props = { params: Promise<{ tableId: string }> };

export default async function SellMarginPage({ params }: Props) {
  const { tableId } = await params;
  return (
    <ConsolePage>
      <SellMarginDetail tableId={tableId} />
    </ConsolePage>
  );
}
