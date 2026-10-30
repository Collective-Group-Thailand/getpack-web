import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
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
      <AccountHeader title={t("title")} lede={t("intro")} />
      <BranchesManager companyId={company.id} branches={company.branches} canManage={company.can.manageSettings} />
    </div>
  );
}
