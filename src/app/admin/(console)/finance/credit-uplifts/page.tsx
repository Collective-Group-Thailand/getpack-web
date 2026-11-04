import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CreditUpliftList } from "@/features/admin/finance/CreditUpliftList";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.creditUplifts"))("title") };
}

/** Credit limits raised by the company's tier (loyalty P3, D-485 / D-501): review, request the full amount, set the mode. */
export default async function Page() {
  const t = await getTranslations("finance.creditUplifts");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <CreditUpliftList />
    </ConsolePage>
  );
}
