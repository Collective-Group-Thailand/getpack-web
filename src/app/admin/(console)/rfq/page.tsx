import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { RfqList } from "@/features/admin/rfq";
import { rfqList } from "@/features/admin/rfq/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("rfq.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RfqPage({ searchParams }: Props) {
  const t = await getTranslations("rfq.list");
  const initial = await prefetchList(rfqList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <RfqList initial={initial} />
    </ConsolePage>
  );
}
