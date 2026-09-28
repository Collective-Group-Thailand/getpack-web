import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { SlipsQueue } from "@/features/admin/finance/slips";
import { slipsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.slips"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Slips that failed the automatic check, for Finance within 4 business hours (D-061). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.slips");
  const initial = await prefetchList(slipsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SlipsQueue initial={initial} />
    </ConsolePage>
  );
}
