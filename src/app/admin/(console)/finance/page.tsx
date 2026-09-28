import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { FinanceHome } from "@/features/admin/finance/FinanceHome";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.home"))("title") };
}

/** The finance home (F6.1): the queues of every desk this person works, with counts and SLA. */
export default async function FinanceHomePage() {
  const t = await getTranslations("finance.home");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <FinanceHome />
    </ConsolePage>
  );
}
