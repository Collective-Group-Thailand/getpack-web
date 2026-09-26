import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ReportView } from "@/features/admin/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("reports"))("title") };
}

type Props = { params: Promise<{ reportKey: string }> };

export default async function ReportPage({ params }: Props) {
  const { reportKey } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ReportView reportKey={reportKey} />
    </ConsolePage>
  );
}
