import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { BankImports, BankingNav } from "@/features/admin/finance/banking";
import { settlementsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.banking.import"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Statement and settlement import (D-093). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.banking.import");
  const initial = await prefetchList(settlementsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <BankingNav />
      <BankImports initial={initial} />
    </ConsolePage>
  );
}
