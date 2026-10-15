import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { StyleImports, StyleLibraryNav } from "@/features/admin/style-library";
import { importsList } from "@/features/admin/style-library/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.imports"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("styleLibrary.imports");
  const initial = await prefetchList(importsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleLibraryNav />
      <StyleImports initial={initial} />
    </ConsolePage>
  );
}
