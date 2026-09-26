import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Inspections, ProductionNav } from "@/features/admin/production";
import { inspectionsList } from "@/features/admin/partners/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("production.inspections"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function InspectionsPage({ searchParams }: Props) {
  const t = await getTranslations("production.inspections");
  const initial = await prefetchList(inspectionsList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ProductionNav />
      <Inspections initial={initial} />
    </ConsolePage>
  );
}
