import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StructuralRequestDetail } from "@/features/admin/structural";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.structural"))("pageTitle") };
}

type Props = { params: Promise<{ requestId: string }> };

export default async function Page({ params }: Props) {
  const { requestId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <StructuralRequestDetail requestId={requestId} />
    </ConsolePage>
  );
}
