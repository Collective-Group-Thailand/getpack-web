import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { TaxNav, TaxReportDetail } from "@/features/admin/finance/tax";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.tax.pages"))("report.title") };
}

type Props = { params: Promise<{ reportId: string }> };

/** One tax report or working paper. */
export default async function Page({ params }: Props) {
  const { reportId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <TaxNav />
      <TaxReportDetail reportId={reportId} />
    </ConsolePage>
  );
}
