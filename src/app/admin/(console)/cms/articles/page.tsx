import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArticlesList } from "@/features/admin/cms";
import { listFor } from "@/features/admin/catalogue/resources";
import { tableByKey } from "@/features/admin/catalogue/tables";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue"))("tables.articles.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ArticlesPage({ searchParams }: Props) {
  const t = await getTranslations("catalogue");
  const initial = await prefetchList(listFor(tableByKey("articles")!), await searchParams);
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("home.cmsTitle"), href: "/cms" }, { label: t("tables.articles.title") }]}
          />
        }
        title={t("tables.articles.title")}
        description={t("tables.articles.description")}
      />
      <ArticlesList initial={initial} />
    </ConsolePage>
  );
}
