import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AuditNav, SamplesView } from "@/features/admin/finance/audit";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.audit.pages"))("samples.title") };
}

/** Audit samples (§8). */
export default async function Page() {
  const t = await getTranslations("finance.audit.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("samples.title")} description={t("samples.description")} />
      <AuditNav />
      <SamplesView />
    </ConsolePage>
  );
}
