import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AssetDetail, AssetsNav } from "@/features/admin/finance/assets";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.assets.pages"))("asset.title") };
}

type Props = { params: Promise<{ assetId: string }> };

/** One fixed asset. */
export default async function Page({ params }: Props) {
  const { assetId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <AssetsNav />
      <AssetDetail assetId={assetId} />
    </ConsolePage>
  );
}
