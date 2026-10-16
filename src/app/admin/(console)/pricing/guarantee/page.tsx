import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { GuaranteePolicy, PricingNav } from "@/features/admin/pricing";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing.guarantee"))("title") };
}

export default async function PricingGuaranteePolicyPage() {
  const t = await getTranslations("pricing.guarantee");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PricingNav />
      <GuaranteePolicy />
    </ConsolePage>
  );
}
