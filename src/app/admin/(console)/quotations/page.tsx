import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { QuotationsList } from "@/features/admin/cs";
import { quotationsList } from "@/features/admin/orders/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.quotations"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function QuotationsPage({ searchParams }: Props) {
  const t = await getTranslations("cs.quotations");
  const initial = await prefetchList(quotationsList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <QuotationsList initial={initial} />
    </ConsolePage>
  );
}
