import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RecommendationsList } from "@/features/admin/advisor";
import { recommendationsList } from "@/features/admin/advisor/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("advisor.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-424: the Structure Advisor desk — the recommendation log, replays and staff runs (D-235 – D-240). */
export default async function AdvisorPage({ searchParams }: Props) {
  const t = await getTranslations("advisor.list");
  const initial = await prefetchList(recommendationsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <RecommendationsList initial={initial} />
    </ConsolePage>
  );
}
