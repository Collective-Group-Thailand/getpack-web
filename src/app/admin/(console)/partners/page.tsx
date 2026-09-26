import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { FactoriesList, PartnersNav } from "@/features/admin/partners";
import { factoriesList } from "@/features/admin/partners/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PartnersPage({ searchParams }: Props) {
  const t = await getTranslations("partners.list");
  const initial = await prefetchList(factoriesList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <FactoriesList initial={initial} />
    </ConsolePage>
  );
}
