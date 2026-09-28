import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { VendorsList, PayablesNav } from "@/features/admin/finance/payables";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payables.vendorsPage"))("title") };
}

/** The vendor master (§6). */
export default async function Page() {
  const t = await getTranslations("finance.payables.vendorsPage");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayablesNav />
      <VendorsList />
    </ConsolePage>
  );
}
