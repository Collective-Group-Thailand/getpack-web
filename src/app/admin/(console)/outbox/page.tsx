import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { Outbox } from "@/features/admin/platform";
import { outboxList } from "@/features/admin/platform/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.outbox"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("platform.outbox");
  const initial = await prefetchList(outboxList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <Outbox initial={initial} />
    </ConsolePage>
  );
}
