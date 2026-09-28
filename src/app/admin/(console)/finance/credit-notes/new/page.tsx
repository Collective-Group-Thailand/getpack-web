import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CreditNoteWizard } from "@/features/admin/finance/credit-notes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.creditNotes.wizard"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The credit-note wizard (accounting-design §2, §8), optionally opened from a tax invoice's order. */
export default async function Page({ searchParams }: Props) {
  const { orderId } = await searchParams;
  return (
    <ConsolePage width="narrow" className="max-w-4xl">
      <CreditNoteWizard orderId={typeof orderId === "string" ? orderId : null} />
    </ConsolePage>
  );
}
