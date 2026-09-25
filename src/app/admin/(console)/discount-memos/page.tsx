import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { MemosList } from "@/features/admin/cs";
import { memosList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.memos"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MemosPage({ searchParams }: Props) {
  const t = await getTranslations("cs.memos");
  const initial = await prefetchList(memosList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MemosList initial={initial} />
    </ConsolePage>
  );
}
