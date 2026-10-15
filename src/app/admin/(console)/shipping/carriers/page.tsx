import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CarriersDesk, ShippingNav } from "@/features/admin/shipping";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shipping.pages.carriers"))("title") };
}

/** D-413: the factory fleet and the fallback carriers with Packio's accounts (D-114, D-005). */
export default async function Page() {
  const t = await getTranslations("shipping.pages.carriers");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ShippingNav />
      <CarriersDesk />
    </ConsolePage>
  );
}
