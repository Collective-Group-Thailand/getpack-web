import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CompanyBankAccounts, BankingNav } from "@/features/admin/finance/banking";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.banking.accountsPage"))("title") };
}

/** Company bank accounts (D-093). */
export default async function Page() {
  const t = await getTranslations("finance.banking.accountsPage");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <BankingNav />
      <CompanyBankAccounts />
    </ConsolePage>
  );
}
