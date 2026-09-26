import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { AuditLog } from "@/features/admin/platform";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.audit"))("title") };
}

/** The audit log (D-140, D-033 §8). A cursor feed, so the client loads it — there is no page to prefetch. */
export default async function AuditLogPage() {
  const t = await getTranslations("platform.audit");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <AuditLog />
    </ConsolePage>
  );
}
