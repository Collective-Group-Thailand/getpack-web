import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { Coverage, PartnersNav } from "@/features/admin/partners";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.coverage"))("title") };
}

export default async function CoveragePage() {
  const t = await getTranslations("partners.coverage");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <Coverage />
    </ConsolePage>
  );
}
