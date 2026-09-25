import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PromotionEditor } from "@/features/admin/marketing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.promotion"))("newTitle") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewPromotionPage({ searchParams }: Props) {
  const { campaignId } = await searchParams;
  return (
    <ConsolePage>
      <PromotionEditor campaignId={typeof campaignId === "string" ? campaignId : null} />
    </ConsolePage>
  );
}
