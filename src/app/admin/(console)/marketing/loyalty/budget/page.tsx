import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MarketingNav } from "@/features/admin/marketing";
import { ProgrammeBudgetPage } from "@/features/admin/marketing/ProgrammeBudget";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.programmeBudget"))("title") };
}

/** The monthly loyalty programme budget (loyalty P4, D-507): use, spend by part, alerts and the override request. */
export default async function ProgrammeBudgetRoute() {
  const t = await getTranslations("marketing.programmeBudget");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <ProgrammeBudgetPage />
    </ConsolePage>
  );
}
