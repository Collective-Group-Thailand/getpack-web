import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AccountsView, LedgerNav } from "@/features/admin/finance/ledger";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("accounts.title") };
}

/** The chart of accounts and its changes (§3, D-169). */
export default async function Page() {
  const t = await getTranslations("finance.ledger.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("accounts.title")} description={t("accounts.description")} />
      <LedgerNav />
      <AccountsView />
    </ConsolePage>
  );
}
