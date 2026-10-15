import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CalendarDesk, ShippingNav } from "@/features/admin/shipping";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shipping.pages.calendar"))("title") };
}

/** D-413: the national business calendar (D-161, D-170). */
export default async function Page() {
  const t = await getTranslations("shipping.pages.calendar");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ShippingNav />
      <CalendarDesk />
    </ConsolePage>
  );
}
