import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { IndexSeries, PartnersNav } from "@/features/admin/partners";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.indices"))("title") };
}

export default async function IndicesPage() {
  const t = await getTranslations("partners.indices");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <IndexSeries />
    </ConsolePage>
  );
}
