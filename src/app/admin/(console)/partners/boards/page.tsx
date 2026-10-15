import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { BoardSheets, PartnersNav } from "@/features/admin/partners";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.boards"))("title") };
}

/** D-414: partners' signed board data sheets per factory and corrugated board (D-188, D-236). */
export default async function BoardSheetsPage() {
  const t = await getTranslations("partners.boards");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <BoardSheets />
    </ConsolePage>
  );
}
