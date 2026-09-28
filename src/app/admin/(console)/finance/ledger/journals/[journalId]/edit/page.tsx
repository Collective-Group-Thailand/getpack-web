import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { JournalEditor } from "@/features/admin/finance/ledger";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("editJournal.title") };
}

type Props = { params: Promise<{ journalId: string }> };

/** A manual journal draft, edited by its maker. */
export default async function Page({ params }: Props) {
  const { journalId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <JournalEditor journalId={journalId} />
    </ConsolePage>
  );
}
