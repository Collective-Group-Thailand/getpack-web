import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { WhtCertificates } from "@/features/admin/finance/receivables";
import { ReceivablesNav } from "@/features/admin/finance/receivables";
import { whtCertificatesList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.receivables.wht"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Customers' 50 ทวิ, chased until received (accounting-design §2). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.receivables.wht");
  const initial = await prefetchList(whtCertificatesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ReceivablesNav />
      <WhtCertificates initial={initial} />
    </ConsolePage>
  );
}
