import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { TemplateForm } from "@/features/partner/insight/QualityForms";
import { qualityPickers } from "@/features/partner/insight/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.templates"))("newTitle") };
}

/** A new inspection template (D-373). */
export default async function NewTemplatePage() {
  const [t, context] = await Promise.all([getTranslations("partnerInsight.templates"), factoryContext()]);
  const pickers = await qualityPickers(context.factoryId);
  return (
    <PartnerPage title={t("newTitle")} back={{ href: "/quality/templates", label: t("title") }}>
      {pickers.data ? <TemplateForm items={pickers.data.items} /> : <PageError error={pickers.error} />}
    </PartnerPage>
  );
}
