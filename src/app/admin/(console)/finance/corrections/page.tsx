import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CorrectionsQueue } from "@/features/admin/finance/document-corrections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.corrections"))("title") };
}

/** Customers' requests to correct the buyer on a tax document (D-431). */
export default function Page() {
  return (
    <ConsolePage>
      <CorrectionsQueue />
    </ConsolePage>
  );
}
