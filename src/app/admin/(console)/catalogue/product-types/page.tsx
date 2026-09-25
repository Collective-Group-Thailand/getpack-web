import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProductTypes } from "@/features/admin/catalogue";
import { listFor } from "@/features/admin/catalogue/resources";
import { tableByKey } from "@/features/admin/catalogue/tables";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.product-types.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductTypesPage({ searchParams }: Props) {
  const t = await getTranslations("catalogue");
  const initial = await prefetchList(listFor(tableByKey("product-types")!), await searchParams);
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[
              { label: t("home.catalogueTitle"), href: "/catalogue" },
              { label: t("tables.product-types.title") },
            ]}
          />
        }
        title={t("tables.product-types.title")}
        description={t("tables.product-types.description")}
      />
      <ProductTypes initial={initial} />
    </ConsolePage>
  );
}
