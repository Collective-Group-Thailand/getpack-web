import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Inbox } from "@/features/admin/sales/Inbox";
import { inboundList } from "@/features/admin/sales/resources";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.inbox"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** ฝ่ายขาย opens on the inbound pool (D-469): the work that has a clock on it. */
export default async function SalesInboxPage({ searchParams }: Props) {
  const t = await getTranslations("sales.inbox");
  const initial = await prefetchList(inboundList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SalesNav />
      <Inbox initial={initial} />
    </ConsolePage>
  );
}
