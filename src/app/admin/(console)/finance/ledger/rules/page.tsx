import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LedgerNav, PostingRulesList } from "@/features/admin/finance/ledger";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("rules.title") };
}

/** The posting rules and their versions (§5, ADR-0007). */
export default async function Page() {
  const t = await getTranslations("finance.ledger.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("rules.title")} description={t("rules.description")} />
      <LedgerNav />
      <PostingRulesList />
    </ConsolePage>
  );
}
