import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ProductionNav, Scorecards } from "@/features/admin/production";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("production.scorecards"))("title") };
}

export default async function ScorecardsPage() {
  const t = await getTranslations("production.scorecards");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ProductionNav />
      <Scorecards />
    </ConsolePage>
  );
}
