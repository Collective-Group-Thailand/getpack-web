import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { SampleDetail } from "@/features/admin/samples";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders.samples"))("pageTitle") };
}

type Props = { params: Promise<{ sampleId: string }> };

export default async function SamplePage({ params }: Props) {
  const { sampleId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <SampleDetail sampleId={sampleId} />
    </ConsolePage>
  );
}
