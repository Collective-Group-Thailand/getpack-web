import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StudioElementsDesk, StudioCatalogNav } from "@/features/admin/content";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.pages.elements"))("title") };
}

/** D-412: the shapes, icons and marks customers place in the studio (D-282). */
export default async function Page() {
  const t = await getTranslations("content.pages.elements");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StudioCatalogNav />
      <StudioElementsDesk />
    </ConsolePage>
  );
}
