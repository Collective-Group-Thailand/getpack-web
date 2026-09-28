import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AuditNav, ExceptionsView } from "@/features/admin/finance/audit";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.audit.pages"))("exceptions.title") };
}

/** Exception reports (§8). */
export default async function Page() {
  const t = await getTranslations("finance.audit.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("exceptions.title")} description={t("exceptions.description")} />
      <AuditNav />
      <ExceptionsView />
    </ConsolePage>
  );
}
