import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ZonesDesk, ShippingNav } from "@/features/admin/shipping";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shipping.pages.zones"))("title") };
}

/** D-413: zone schemes, zones and their postcodes (D-013, D-114). */
export default async function Page() {
  const t = await getTranslations("shipping.pages.zones");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ShippingNav />
      <ZonesDesk />
    </ConsolePage>
  );
}
