import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { SalesQuotes } from "@/features/admin/sales/Quotes";
import { salesQuotesList } from "@/features/admin/sales/resources";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.quotes"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SalesQuotesPage({ searchParams }: Props) {
  const t = await getTranslations("sales.quotes");
  const initial = await prefetchList(salesQuotesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SalesNav />
      <SalesQuotes initial={initial} />
    </ConsolePage>
  );
}
