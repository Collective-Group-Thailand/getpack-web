import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { AssetRegister, AssetsNav } from "@/features/admin/finance/assets";
import { fixedAssetsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.assets.pages"))("register.title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The fixed-asset register (D-150). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.assets.pages");
  const initial = await prefetchList(fixedAssetsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("register.title")} description={t("register.description")} />
      <AssetsNav />
      <AssetRegister initial={initial} />
    </ConsolePage>
  );
}
