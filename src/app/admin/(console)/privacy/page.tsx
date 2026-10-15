import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PrivacyDesk } from "@/features/admin/content";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.pages.privacy"))("title") };
}

/** D-412: PDPA requests, consent texts and agreement versions (D-086, D-089, D-222). */
export default async function Page() {
  const t = await getTranslations("content.pages.privacy");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PrivacyDesk />
    </ConsolePage>
  );
}
