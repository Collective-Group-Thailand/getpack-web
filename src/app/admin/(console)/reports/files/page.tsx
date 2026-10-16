import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportFiles, ReportsNav } from "@/features/admin/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("reports.files"))("title") };
}

/** D-424: report files (D-111). */
export default async function ReportReportFilesPage() {
  const t = await getTranslations("reports.files");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsNav />
      <ReportFiles />
    </ConsolePage>
  );
}
