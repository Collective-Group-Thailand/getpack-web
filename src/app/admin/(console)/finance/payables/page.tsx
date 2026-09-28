import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PayablesList, PayablesNav } from "@/features/admin/finance/payables";
import { payablesList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.open"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** AP open items and when each becomes payable (§6, D-022). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payables.open");
  const initial = await prefetchList(payablesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <PayablesList initial={initial} />
    </ConsolePage>
  );
}
