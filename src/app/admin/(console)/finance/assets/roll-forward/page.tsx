import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AssetRollForward, AssetsNav } from "@/features/admin/finance/assets";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.assets.pages"))("rollForward.title") };
}

/** The fixed-asset roll-forward and its reconciliation to the GL. */
export default async function Page() {
  const t = await getTranslations("finance.assets.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("rollForward.title")} description={t("rollForward.description")} />
      <AssetsNav />
      <AssetRollForward />
    </ConsolePage>
  );
}
