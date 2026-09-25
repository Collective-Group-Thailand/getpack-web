import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TablesIndex } from "@/features/admin/catalogue";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.home"))("cmsTitle") };
}

export default async function CmsPage() {
  const t = await getTranslations("catalogue.home");
  return (
    <ConsolePage>
      <PageHeader title={t("cmsTitle")} description={t("cmsDescription")} />
      <TablesIndex zone="cms" />
    </ConsolePage>
  );
}
