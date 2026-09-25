import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CatalogueImport } from "@/features/admin/catalogue";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.import.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const KINDS = new Set<string>([
  "geography",
  "materials",
  "finishes",
  "ink_colours",
  "patterns",
  "standard_sizes",
  "stock_attribute_values",
  "stock_products",
]);

export default async function CatalogueImportPage({ searchParams }: Props) {
  const t = await getTranslations("catalogue");
  const kind = (await searchParams).kind;
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("home.catalogueTitle"), href: "/catalogue" }, { label: t("tables.import.title") }]}
          />
        }
        title={t("tables.import.title")}
        description={t("tables.import.description")}
      />
      <CatalogueImport
        initialKind={typeof kind === "string" && KINDS.has(kind) ? (kind as Schemas["CatalogImportKind"]) : null}
      />
    </ConsolePage>
  );
}
