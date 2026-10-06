import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BranchesManager } from "@/features/customer/business/BranchesManager";
import { requireMember } from "@/features/customer/business/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.branches");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Head office and branches (F3 3.7, D-125). */
export default async function Page() {
  const company = await requireMember();
  const t = await getTranslations("business.branches");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[2rem] leading-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <BranchesManager companyId={company.id} branches={company.branches} canManage={company.can.manageSettings} />
    </div>
  );
}
