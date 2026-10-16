import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportSchedules, ReportsNav } from "@/features/admin/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("reports.schedules"))("title") };
}

/** D-424: report schedules (D-111). */
export default async function ReportReportSchedulesPage() {
  const t = await getTranslations("reports.schedules");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsNav />
      <ReportSchedules />
    </ConsolePage>
  );
}
