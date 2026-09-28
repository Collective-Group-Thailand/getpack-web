import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AgingReport, ReceivablesNav } from "@/features/admin/finance/receivables";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.receivables.aging"))("title") };
}

/** Aging by party at a date, and the allowance (P30). */
export default async function Page() {
  const t = await getTranslations("finance.receivables.items");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ReceivablesNav />
      <AgingReport />
    </ConsolePage>
  );
}
