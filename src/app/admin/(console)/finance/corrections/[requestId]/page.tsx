import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CorrectionDetail } from "@/features/admin/finance/document-corrections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.corrections"))("title") };
}

type Props = { params: Promise<{ requestId: string }> };

/** One correction request and Finance's decision (D-431). */
export default async function Page({ params }: Props) {
  const { requestId } = await params;
  return (
    <ConsolePage>
      <CorrectionDetail requestId={requestId} />
    </ConsolePage>
  );
}
