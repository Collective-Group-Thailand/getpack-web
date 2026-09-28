import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { DocumentsRegister } from "@/features/admin/finance/documents";
import { documentsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.documents"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The customer document registers (accounting-design §4). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.documents");
  const initial = await prefetchList(documentsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <DocumentsRegister initial={initial} />
    </ConsolePage>
  );
}
