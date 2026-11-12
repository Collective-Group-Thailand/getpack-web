import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { WaterfallViewsLog } from "@/features/admin/sales/approvals/Queue";
import { waterfallViewsList } from "@/features/admin/sales/resources";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.views"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function WaterfallViewsPage({ searchParams }: Props) {
  const t = await getTranslations("sales.views");
  const initial = await prefetchList(waterfallViewsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SalesNav />
      <WaterfallViewsLog initial={initial} />
    </ConsolePage>
  );
}
