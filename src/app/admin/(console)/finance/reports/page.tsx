import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportsNav, TrialBalanceView } from "@/features/admin/finance/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.reports.pages"))("trialBalance.title") };
}

/** The trial balance (§6). */
export default async function Page() {
  const t = await getTranslations("finance.reports.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("trialBalance.title")} description={t("trialBalance.description")} />
      <ReportsNav />
      <TrialBalanceView />
    </ConsolePage>
  );
}
