import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PlaybookList } from "@/features/admin/sales/Playbook";
import { playbookList } from "@/features/admin/sales/resources";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.playbook"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlaybookPage({ searchParams }: Props) {
  const t = await getTranslations("sales.playbook");
  const initial = await prefetchList(playbookList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SalesNav />
      <PlaybookList initial={initial} />
    </ConsolePage>
  );
}
