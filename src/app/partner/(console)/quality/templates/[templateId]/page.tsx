import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { TemplateForm } from "@/features/partner/insight/QualityForms";
import { qualityPickers } from "@/features/partner/insight/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.templates"))("editTitle") };
}

/** Edits an inspection template (D-373); checks already made keep their copy. */
export default async function TemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const [{ templateId }, t, context] = await Promise.all([
    params,
    getTranslations("partnerInsight.templates"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [read, pickers] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET(
        "/v1/partner/factories/{factoryId}/erp/inspection-templates/{templateId}",
        {
          params: { path: { factoryId: context.factoryId, templateId } },
        },
      );
      return { template: data!, etag: response.headers.get("etag") };
    }),
    qualityPickers(context.factoryId),
  ]);
  const back = { href: "/quality/templates", label: t("title") };
  return (
    <PartnerPage full title={read.data?.template.name ?? t("editTitle")} back={back}>
      {read.data && pickers.data ? (
        <TemplateForm template={read.data.template} etag={read.data.etag} items={pickers.data.items} />
      ) : (
        <PageError error={read.error ?? pickers.error} />
      )}
    </PartnerPage>
  );
}
