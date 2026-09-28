import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PayoutRunsList } from "@/features/admin/finance/payouts";
import { payoutRunsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payouts"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Payout runs (D-022, D-166). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payouts");
  const initial = await prefetchList(payoutRunsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayoutRunsList initial={initial} />
    </ConsolePage>
  );
}
