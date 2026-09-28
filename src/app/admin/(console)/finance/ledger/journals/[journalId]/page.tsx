import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { JournalDetail } from "@/features/admin/finance/journals";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.journals.detail"))("title") };
}

type Props = { params: Promise<{ journalId: string }> };

/** One journal entry and its trail. */
export default async function Page({ params }: Props) {
  const { journalId } = await params;
  return (
    <ConsolePage>
      <JournalDetail journalId={journalId} />
    </ConsolePage>
  );
}
