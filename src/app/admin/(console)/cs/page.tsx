import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CalculatorPicker } from "@/features/admin/cs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.picker"))("title") };
}

export default async function CalculatorsPage() {
  const t = await getTranslations("cs.picker");
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <CalculatorPicker />
    </ConsolePage>
  );
}
