import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LedgerNav, RecurringJournals } from "@/features/admin/finance/ledger";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("recurring.title") };
}

/** Recurring journals (§8). */
export default async function Page() {
  const t = await getTranslations("finance.ledger.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("recurring.title")} description={t("recurring.description")} />
      <LedgerNav />
      <RecurringJournals />
    </ConsolePage>
  );
}
