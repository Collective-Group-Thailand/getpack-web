import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MarketingNav, SurveysAdmin } from "@/features/admin/marketing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.surveys"))("title") };
}

/** In-app survey templates and their results (loyalty P2, D-491). */
export default async function SurveysPage() {
  const t = await getTranslations("marketing.surveys");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <MarketingNav />
      <SurveysAdmin />
    </ConsolePage>
  );
}
