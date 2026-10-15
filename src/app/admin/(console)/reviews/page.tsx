import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReviewsDesk } from "@/features/admin/content";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.pages.reviews"))("title") };
}

/** D-412: customer reviews — moderation and Packio's replies (D-265). */
export default async function Page() {
  const t = await getTranslations("content.pages.reviews");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ReviewsDesk />
    </ConsolePage>
  );
}
