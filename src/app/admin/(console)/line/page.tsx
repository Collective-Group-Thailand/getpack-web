import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LineMenusDesk } from "@/features/admin/content";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.pages.line"))("title") };
}

/** D-412: the LINE Official Account's rich menus (D-151). */
export default async function Page() {
  const t = await getTranslations("content.pages.line");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <LineMenusDesk />
    </ConsolePage>
  );
}
