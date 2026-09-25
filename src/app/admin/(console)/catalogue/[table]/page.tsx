import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CatalogueTable } from "@/features/admin/catalogue";
import { listFor } from "@/features/admin/catalogue/resources";
import { tableByKey } from "@/features/admin/catalogue/tables";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

type Props = {
  params: Promise<{ table: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const def = tableByKey((await params).table, "catalogue");
  const t = await getTranslations("catalogue");
  return { title: def ? t(`tables.${def.key}.title`) : t("home.catalogueTitle") };
}

/** Any declared catalogue table (`src/features/admin/catalogue/tables.ts`); anything else is a 404. */
export default async function CatalogueTablePage({ params, searchParams }: Props) {
  const [{ table }, query] = await Promise.all([params, searchParams]);
  const def = tableByKey(table, "catalogue");
  if (!def) notFound();
  const t = await getTranslations("catalogue");
  const initial = await prefetchList(listFor(def), query);
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("home.catalogueTitle"), href: "/catalogue" }, { label: t(`tables.${def.key}.title`) }]}
          />
        }
        title={t(`tables.${def.key}.title`)}
        description={t(`tables.${def.key}.description`)}
      />
      <CatalogueTable tableKey={def.key} initial={initial} />
    </ConsolePage>
  );
}
