import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CustomerRateCard, ShippingNav } from "@/features/admin/shipping";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shipping.pages.rates"))("title") };
}

/** D-413: the customer shipping rate card — versions, Excel, approval, a quote check (D-013, D-063). */
export default async function Page() {
  const t = await getTranslations("shipping.pages.rates");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ShippingNav />
      <CustomerRateCard />
    </ConsolePage>
  );
}
