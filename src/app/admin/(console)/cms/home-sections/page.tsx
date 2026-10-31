import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HomeSections } from "@/features/admin/catalogue";
import { listFor } from "@/features/admin/catalogue/resources";
import { tableByKey } from "@/features/admin/catalogue/tables";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.home-sections.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomeSectionsPage({ searchParams }: Props) {
  const t = await getTranslations("catalogue");
  const initial = await prefetchList(listFor(tableByKey("home-sections")!), await searchParams);
  return (
    <ConsolePage>
      <PageHeader
        back={{ href: "/cms", label: t("home.cmsTitle") }}
        title={t("tables.home-sections.title")}
        description={t("tables.home-sections.description")}
      />
      <HomeSections initial={initial} />
    </ConsolePage>
  );
}
