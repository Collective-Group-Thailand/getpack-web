import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AssetsNav, DepreciationView } from "@/features/admin/finance/assets";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.assets.pages"))("depreciation.title") };
}

/** The monthly depreciation run (D-150). */
export default async function Page() {
  const t = await getTranslations("finance.assets.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("depreciation.title")} description={t("depreciation.description")} />
      <AssetsNav />
      <DepreciationView />
    </ConsolePage>
  );
}
