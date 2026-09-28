import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { TaxNav, TaxSettings } from "@/features/admin/finance/tax";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.tax.pages"))("settings.title") };
}

/** Tax rates and settings (D-033, D-091). */
export default async function Page() {
  const t = await getTranslations("finance.tax.pages");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <TaxNav />
      <TaxSettings />
    </ConsolePage>
  );
}
