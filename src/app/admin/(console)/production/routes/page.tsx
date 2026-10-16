import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ProductionNav, MilestoneRoutes } from "@/features/admin/production";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("production.routes"))("title") };
}

/** D-424: milestone routes — the production steps a job reports (D-075). */
export default async function MilestoneRoutesPage() {
  const t = await getTranslations("production.routes");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ProductionNav />
      <MilestoneRoutes />
    </ConsolePage>
  );
}
