import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AuditNav, AuditorHome } from "@/features/admin/finance/audit";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.audit.pages"))("home.title") };
}

/** The auditor's desk (§8, D-168). */
export default async function Page() {
  const t = await getTranslations("finance.audit.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("home.title")} description={t("home.description")} />
      <AuditNav />
      <AuditorHome />
    </ConsolePage>
  );
}
