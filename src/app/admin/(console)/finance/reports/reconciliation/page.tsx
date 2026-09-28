import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReconciliationView, ReportsNav } from "@/features/admin/finance/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.reports.pages"))("reconciliation.title") };
}

/** Sub-ledgers against the GL (§7 step 8). */
export default async function Page() {
  const t = await getTranslations("finance.reports.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("reconciliation.title")} description={t("reconciliation.description")} />
      <ReportsNav />
      <ReconciliationView />
    </ConsolePage>
  );
}
