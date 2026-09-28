import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LedgerNav, PeriodsView } from "@/features/admin/finance/ledger";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("periods.title") };
}

/** Fiscal periods (§1.4). */
export default async function Page() {
  const t = await getTranslations("finance.ledger.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("periods.title")} description={t("periods.description")} />
      <LedgerNav />
      <PeriodsView />
    </ConsolePage>
  );
}
