import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompaniesList } from "@/features/admin/companies";
import { companiesList } from "@/features/admin/companies/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("companies.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CompaniesPage({ searchParams }: Props) {
  const t = await getTranslations("companies.list");
  const initial = await prefetchList(companiesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <CompaniesList initial={initial} />
    </ConsolePage>
  );
}
