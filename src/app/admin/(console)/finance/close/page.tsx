import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CloseIndex } from "@/features/admin/finance/close";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.close.pages"))("index.title") };
}

/** Where each month's close stands (§7). */
export default async function Page() {
  const t = await getTranslations("finance.close.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("index.title")} description={t("index.description")} />
      <CloseIndex />
    </ConsolePage>
  );
}
