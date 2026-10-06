import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getBrandAssets } from "@/features/customer/business/api.server";
import { BrandAssets } from "@/features/customer/business/BrandAssets";
import { requireMember } from "@/features/customer/business/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.assets");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Shared brand assets (F3 3.7). */
export default async function Page() {
  const company = await requireMember();
  const [t, assets] = await Promise.all([getTranslations("business.assets"), getBrandAssets(company.id)]);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[2rem] leading-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <BrandAssets companyId={company.id} assets={assets ?? []} canManage={company.can.manageAssets} />
    </div>
  );
}
