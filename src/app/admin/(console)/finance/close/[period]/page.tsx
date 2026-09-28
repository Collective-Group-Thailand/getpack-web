import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CloseChecklistView } from "@/features/admin/finance/close";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.close.pages"))("checklist.title") };
}

type Props = { params: Promise<{ period: string }> };

/** One month's close checklist (§7). */
export default async function Page({ params }: Props) {
  const { period } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <CloseChecklistView month={period} />
    </ConsolePage>
  );
}
