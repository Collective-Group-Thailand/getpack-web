import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { BillingStatementsList, PayablesNav } from "@/features/admin/finance/payables";
import { billingStatementsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.statements"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Billing statements for the factories to confirm (D-090). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payables.statements");
  const initial = await prefetchList(billingStatementsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <BillingStatementsList initial={initial} />
    </ConsolePage>
  );
}
