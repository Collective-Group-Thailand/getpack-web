import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { FitRangeBackfill, StyleLibraryNav } from "@/features/admin/style-library";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.fitRanges"))("title") };
}

export default async function Page() {
  const t = await getTranslations("styleLibrary.fitRanges");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleLibraryNav />
      <FitRangeBackfill />
    </ConsolePage>
  );
}
