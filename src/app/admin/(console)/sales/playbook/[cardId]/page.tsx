import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PlaybookEditor } from "@/features/admin/sales/Playbook";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.playbook.editor"))("pageTitle") };
}

type Props = { params: Promise<{ cardId: string }> };

export default async function PlaybookCardPage({ params }: Props) {
  const { cardId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PlaybookEditor cardId={cardId} />
    </ConsolePage>
  );
}
