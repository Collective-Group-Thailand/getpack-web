import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CalculatorWorkspace } from "@/features/admin/cs";
import { CALCULATORS } from "@/features/admin/cs/calculators";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const t = await getTranslations("cs.picker");
  const { type } = await params;
  return { title: t.has(`types.${type}.name`) ? t(`types.${type}.name`) : t("title") };
}

export default async function CalculatorPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const calculator = CALCULATORS.find((candidate) => candidate.key === type);
  if (!calculator) notFound();
  const t = await getTranslations("cs.picker");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/cs" }, { label: t(`types.${calculator.key}.name`) }]}
          />
        }
        title={t(`types.${calculator.key}.name`)}
        description={t(`types.${calculator.key}.description`)}
      />
      <CalculatorWorkspace type={calculator.key} />
    </ConsolePage>
  );
}
