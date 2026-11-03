import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { NegotiationsReport } from "@/features/admin/sales/Reports";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.reports.negotiations"))("pageTitle") };
}

export default async function Page() {
  const t = await getTranslations("sales.reports.negotiations");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("pageTitle")} description={t("description")} />
      <SalesNav />
      <NegotiationsReport />
    </ConsolePage>
  );
}
