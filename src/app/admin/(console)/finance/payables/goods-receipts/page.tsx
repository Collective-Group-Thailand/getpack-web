import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { GoodsReceiptsList, PayablesNav } from "@/features/admin/finance/payables";
import { goodsReceiptsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.goodsReceipts"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Goods receipts from POD (P15, D-165). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payables.goodsReceipts");
  const initial = await prefetchList(goodsReceiptsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <GoodsReceiptsList initial={initial} />
    </ConsolePage>
  );
}
