import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ChangeRequests, PartnersNav } from "@/features/admin/partners";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.requests"))("title") };
}

/** D-414: what factories asked the Partner team to change, and the team's answers (U-B0.3). */
export default async function ChangeRequestsPage() {
  const t = await getTranslations("partners.requests");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PartnersNav />
      <ChangeRequests />
    </ConsolePage>
  );
}
