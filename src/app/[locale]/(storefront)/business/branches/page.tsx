import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getBranches } from "@/features/customer/business/api.server";
import { BranchesManager } from "@/features/customer/business/BranchesManager";
import { requireMember } from "@/features/customer/business/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.branches");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Head office and branches (F3 3.7, D-125). */
export default async function Page() {
  const company = await requireMember();
  const [t, branches] = await Promise.all([getTranslations("business.branches"), getBranches()]);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <BranchesManager branches={branches?.data ?? []} canManage={company.can.manageSettings} />
    </div>
  );
}
