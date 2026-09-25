import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { QuotationDetail } from "@/features/admin/cs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.quotations"))("detailTitle") };
}

export default async function QuotationPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  return (
    <ConsolePage>
      <QuotationDetail quoteId={quoteId} />
    </ConsolePage>
  );
}
