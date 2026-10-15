import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HomeCases } from "@/features/admin/catalogue";
import { listFor } from "@/features/admin/catalogue/resources";
import { tableByKey } from "@/features/admin/catalogue/tables";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.home-cases.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomeCasesPage({ searchParams }: Props) {
  const t = await getTranslations("catalogue");
  const initial = await prefetchList(listFor(tableByKey("home-cases")!), await searchParams);
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("home.cmsTitle"), href: "/cms" }, { label: t("tables.home-cases.title") }]}
          />
        }
        title={t("tables.home-cases.title")}
        description={t("tables.home-cases.description")}
      />
      <HomeCases initial={initial} />
    </ConsolePage>
  );
}
