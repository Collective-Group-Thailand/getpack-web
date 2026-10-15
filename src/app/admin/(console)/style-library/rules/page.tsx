import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StyleRules, StyleLibraryNav } from "@/features/admin/style-library";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.rules"))("title") };
}

export default async function Page() {
  const t = await getTranslations("styleLibrary.rules");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleLibraryNav />
      <StyleRules />
    </ConsolePage>
  );
}
