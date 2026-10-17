import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Readiness } from "@/features/admin/catalogue";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.readiness.title") };
}

export default async function CatalogueReadinessPage() {
  const t = await getTranslations("catalogue");
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("home.catalogueTitle"), href: "/catalogue" }, { label: t("tables.readiness.title") }]}
          />
        }
        title={t("tables.readiness.title")}
        description={t("tables.readiness.description")}
      />
      <Readiness />
    </ConsolePage>
  );
}
