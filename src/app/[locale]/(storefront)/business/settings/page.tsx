import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompanySettings } from "@/features/customer/business/CompanySettings";
import { requireMember } from "@/features/customer/business/guard.server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.settings");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The company admin's settings (F3 3.7; D-123, D-125). */
export default async function Page() {
  const company = await requireMember();
  const t = await getTranslations("business.settings");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      {company.can.manageSettings ? (
        <CompanySettings threshold={company.orderApprovalThreshold} poNumberPolicy={company.poNumberPolicy} />
      ) : (
        <Callout tone="info">{t("adminOnly")}</Callout>
      )}
    </div>
  );
}
