import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PrepressList } from "@/features/admin/prepress";
import { prepressList } from "@/features/admin/prepress/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("prepress.list"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PrepressPage({ searchParams }: Props) {
  const t = await getTranslations("prepress.list");
  const initial = await prefetchList(prepressList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <PrepressList initial={initial} />
    </ConsolePage>
  );
}
