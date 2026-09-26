import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { ClaimsList } from "@/features/admin/logistics";
import { claimsList } from "@/features/admin/logistics/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("logistics.claims"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ClaimsPage({ searchParams }: Props) {
  const t = await getTranslations("logistics.claims");
  const initial = await prefetchList(claimsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ClaimsList initial={initial} />
    </ConsolePage>
  );
}
