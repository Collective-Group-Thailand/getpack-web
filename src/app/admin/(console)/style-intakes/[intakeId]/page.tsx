import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StyleIntakeDetail } from "@/features/admin/structural";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.intakes"))("pageTitle") };
}

type Props = { params: Promise<{ intakeId: string }> };

export default async function Page({ params }: Props) {
  const { intakeId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <StyleIntakeDetail intakeId={intakeId} />
    </ConsolePage>
  );
}
