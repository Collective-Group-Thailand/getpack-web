import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { BalanceSheetView, ReportsNav } from "@/features/admin/finance/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.reports.pages"))("balanceSheet.title") };
}

/** The balance sheet (§6). */
export default async function Page() {
  const t = await getTranslations("finance.reports.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("balanceSheet.title")} description={t("balanceSheet.description")} />
      <ReportsNav />
      <BalanceSheetView />
    </ConsolePage>
  );
}
