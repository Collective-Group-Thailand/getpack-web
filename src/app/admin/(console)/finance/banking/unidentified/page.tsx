import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { UnidentifiedReceipts, BankingNav } from "@/features/admin/finance/banking";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.banking.unidentifiedPage"))("title") };
}

/** Unidentified receipts (P29). */
export default async function Page() {
  const t = await getTranslations("finance.banking.unidentifiedPage");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <BankingNav />
      <UnidentifiedReceipts />
    </ConsolePage>
  );
}
