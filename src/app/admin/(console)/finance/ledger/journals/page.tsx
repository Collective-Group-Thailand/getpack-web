import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { JournalsList } from "@/features/admin/finance/journals";
import { LedgerNav } from "@/features/admin/finance/ledger";
import { journalsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.journals"))("journals") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Journal entries (accounting-design §1). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.journals");
  const initial = await prefetchList(journalsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("journals")} description={t("description")} />
      <LedgerNav />
      <JournalsList initial={initial} />
    </ConsolePage>
  );
}
