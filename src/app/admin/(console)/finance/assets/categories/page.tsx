import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AssetCategories, AssetsNav } from "@/features/admin/finance/assets";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.assets.pages"))("categories.title") };
}

/** Asset categories (D-150). */
export default async function Page() {
  const t = await getTranslations("finance.assets.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("categories.title")} description={t("categories.description")} />
      <AssetsNav />
      <AssetCategories />
    </ConsolePage>
  );
}
