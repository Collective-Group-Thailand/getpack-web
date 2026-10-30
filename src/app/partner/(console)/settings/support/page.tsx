import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SettingsFrame } from "@/features/partner/settings/SettingsFrame";
import { SupportGrants } from "@/features/partner/insight/PeopleForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.support"))("title") };
}

/** D-381: the owner lets getpack support read the ERP's dashboard and settings for a few days, and sees each read. */
export default async function SupportAccessPage() {
  const [t, tSettings, context] = await Promise.all([
    getTranslations("partnerInsight.support"),
    getTranslations("partnerAccount.settings"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/support-grants", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/settings", label: tSettings("title") }}
    >
      <SettingsFrame current="support">
        {read.data ? <SupportGrants grants={read.data} /> : <PageError error={read.error} />}
      </SettingsFrame>
    </PartnerPage>
  );
}
