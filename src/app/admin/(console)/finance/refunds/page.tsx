import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { RefundsList } from "@/features/admin/finance/payments";
import { refundsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.refunds"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Refunds and their approval (D-169). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.refunds");
  const initial = await prefetchList(refundsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <RefundsList initial={initial} />
    </ConsolePage>
  );
}
