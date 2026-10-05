import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { SamplesList } from "@/features/admin/samples";
import { samplesList } from "@/features/admin/samples/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.samples"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The sample queue (U2.F3). packio-api's menu has no entry yet: reached from Orders (CONTRACT-REQUEST admin.menu-samples). */
export default async function SamplesPage({ searchParams }: Props) {
  const t = await getTranslations("orders.samples");
  const initial = await prefetchList(samplesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <SamplesList initial={initial} />
    </ConsolePage>
  );
}
