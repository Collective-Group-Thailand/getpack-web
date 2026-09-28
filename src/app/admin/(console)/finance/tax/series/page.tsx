import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { DocumentSeries, TaxNav } from "@/features/admin/finance/tax";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.tax.pages"))("series.title") };
}

/** Document numbering (D-092). */
export default async function Page() {
  const t = await getTranslations("finance.tax.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("series.title")} description={t("series.description")} />
      <TaxNav />
      <DocumentSeries />
    </ConsolePage>
  );
}
