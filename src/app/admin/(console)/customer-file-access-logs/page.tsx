import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CustomerFileAccessLog } from "@/features/admin/platform";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.fileAccess"))("title") };
}

/**
 * The customer file access log (D-444; C1f, D-451): who opened which customer file, and the reason a Superadmin typed.
 * A cursor feed, so the client loads it — there is no page to prefetch. The API's menu decides who reaches it.
 */
export default async function CustomerFileAccessLogPage() {
  const t = await getTranslations("platform.fileAccess");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <CustomerFileAccessLog />
    </ConsolePage>
  );
}
