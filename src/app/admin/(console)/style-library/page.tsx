import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { StyleLibraryNav, StylesList } from "@/features/admin/style-library";
import { stylesList } from "@/features/admin/style-library/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** D-411: the style library desk — every base, what keeps it off the storefront, and its sign-offs. */
export default async function StyleLibraryPage({ searchParams }: Props) {
  const t = await getTranslations("styleLibrary.list");
  const initial = await prefetchList(stylesList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleLibraryNav />
      <StylesList initial={initial} />
    </ConsolePage>
  );
}
