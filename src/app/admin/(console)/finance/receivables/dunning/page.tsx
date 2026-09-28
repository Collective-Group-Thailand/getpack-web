import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { DunningLog } from "@/features/admin/finance/receivables";
import { ReceivablesNav } from "@/features/admin/finance/receivables";
import { dunningList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.receivables.dunning"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Payment reminders sent (D-122). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.receivables.dunning");
  const initial = await prefetchList(dunningList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ReceivablesNav />
      <DunningLog initial={initial} />
    </ConsolePage>
  );
}
