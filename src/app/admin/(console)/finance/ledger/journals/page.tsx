import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { JournalsList } from "@/features/admin/finance/journals";
import { journalsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.journals"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Journal entries (accounting-design §1). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.journals");
  const initial = await prefetchList(journalsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <JournalsList initial={initial} />
    </ConsolePage>
  );
}
