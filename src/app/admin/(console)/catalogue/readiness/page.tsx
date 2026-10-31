import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Readiness } from "@/features/admin/catalogue";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.readiness.title") };
}

export default async function CatalogueReadinessPage() {
  const t = await getTranslations("catalogue");
  return (
    <ConsolePage>
      <PageHeader
        back={{ href: "/catalogue", label: t("home.catalogueTitle") }}
        title={t("tables.readiness.title")}
        description={t("tables.readiness.description")}
      />
      <Readiness />
    </ConsolePage>
  );
}
