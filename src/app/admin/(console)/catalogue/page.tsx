import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TablesIndex } from "@/features/admin/catalogue";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StyleWorkLinks } from "@/features/admin/structural/StyleWorkLinks";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.home"))("catalogueTitle") };
}

export default async function CataloguePage() {
  const t = await getTranslations("catalogue.home");
  return (
    <ConsolePage>
      <PageHeader title={t("catalogueTitle")} description={t("catalogueDescription")} actions={<StyleWorkLinks />} />
      <TablesIndex zone="catalogue" />
    </ConsolePage>
  );
}
