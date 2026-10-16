import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PaymentSchedules, PricingNav } from "@/features/admin/pricing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing.schedules"))("title") };
}

export default async function PricingPaymentSchedulesPage() {
  const t = await getTranslations("pricing.schedules");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PricingNav />
      <PaymentSchedules />
    </ConsolePage>
  );
}
