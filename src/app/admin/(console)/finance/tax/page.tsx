import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { TaxNav, TaxReports } from "@/features/admin/finance/tax";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.tax.pages"))("reports.title") };
}

/** The month's tax reports and working papers with their GL reconciliation (D-033). */
export default async function Page() {
  const t = await getTranslations("finance.tax.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />
      <TaxNav />
      <TaxReports />
    </ConsolePage>
  );
}
