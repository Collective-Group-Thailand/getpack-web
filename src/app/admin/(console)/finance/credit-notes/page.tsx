import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { CreditNoteRequests } from "@/features/admin/finance/credit-notes";
import { creditRequestsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.creditNotes"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Credit notes requested and issued (D-169). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.creditNotes");
  const initial = await prefetchList(creditRequestsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <CreditNoteRequests initial={initial} />
    </ConsolePage>
  );
}
