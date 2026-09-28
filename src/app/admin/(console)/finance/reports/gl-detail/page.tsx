import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { GlDetailView, ReportsNav } from "@/features/admin/finance/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.reports.pages"))("glDetail.title") };
}

/** GL detail with drill-down (§6). */
export default async function Page() {
  const t = await getTranslations("finance.reports.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("glDetail.title")} description={t("glDetail.description")} />
      <ReportsNav />
      <GlDetailView />
    </ConsolePage>
  );
}
