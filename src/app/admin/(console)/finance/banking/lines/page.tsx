import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { BankLines, BankingNav } from "@/features/admin/finance/banking";
import { bankLinesList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.banking.lines"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The matching workbench (§6). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.banking.lines");
  const initial = await prefetchList(bankLinesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <BankingNav />
      <BankLines initial={initial} />
    </ConsolePage>
  );
}
