import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { DocumentDetail } from "@/features/admin/finance/documents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.documents.detail"))("title") };
}

type Props = { params: Promise<{ documentId: string }> };

/** One customer document as issued. */
export default async function Page({ params }: Props) {
  const { documentId } = await params;
  return (
    <ConsolePage>
      <DocumentDetail documentId={documentId} />
    </ConsolePage>
  );
}
