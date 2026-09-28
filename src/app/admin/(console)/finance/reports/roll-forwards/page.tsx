import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportsNav, RollForwardsView } from "@/features/admin/finance/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.reports.pages"))("rollForwards.title") };
}

/** Points liability and retention roll-forwards. */
export default async function Page() {
  const t = await getTranslations("finance.reports.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("rollForwards.title")} description={t("rollForwards.description")} />
      <ReportsNav />
      <RollForwardsView />
    </ConsolePage>
  );
}
