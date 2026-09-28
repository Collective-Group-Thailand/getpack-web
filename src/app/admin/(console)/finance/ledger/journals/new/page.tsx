import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { JournalEditor } from "@/features/admin/finance/ledger";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("newJournal.title") };
}

/** A new manual journal (§1.1, §8). */
export default async function Page() {
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <JournalEditor />
    </ConsolePage>
  );
}
