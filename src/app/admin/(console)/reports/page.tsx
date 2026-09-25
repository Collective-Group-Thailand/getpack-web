import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportsIndex } from "@/features/admin/reports";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("reports"))("title") };
}

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsIndex />
    </ConsolePage>
  );
}
