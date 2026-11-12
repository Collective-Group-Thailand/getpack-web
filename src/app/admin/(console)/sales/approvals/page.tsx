import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { ApprovalsQueue } from "@/features/admin/sales/approvals/Queue";
import { approvalsList } from "@/features/admin/sales/resources";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.approvals"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ApprovalsPage({ searchParams }: Props) {
  const t = await getTranslations("sales.approvals");
  const initial = await prefetchList(approvalsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SalesNav />
      <ApprovalsQueue initial={initial} />
    </ConsolePage>
  );
}
