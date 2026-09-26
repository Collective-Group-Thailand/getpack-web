import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PromotionEditor } from "@/features/admin/marketing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.promotion"))("pageTitle") };
}

type Props = { params: Promise<{ promotionId: string }> };

export default async function PromotionPage({ params }: Props) {
  const { promotionId } = await params;
  return (
    <ConsolePage>
      <PromotionEditor promotionId={promotionId} />
    </ConsolePage>
  );
}
