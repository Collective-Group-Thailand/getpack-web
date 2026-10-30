import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SettingsFrame } from "@/features/partner/settings/SettingsFrame";
import { DocumentBrandingEditor } from "@/features/shared/document-branding/DocumentBrandingEditor";
import { MySignatures } from "@/features/shared/document-branding/MySignatures";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("docBranding"))("partnerTitle") };
}

/**
 * The factory's document branding (D-428, D-429): the logo and seal on its ERP documents, its signatories and who
 * signs which kind of document — changed by whoever configures the ERP (`factory_erp.configure`) — and, for
 * everyone, their own signature where the factory named them signatory.
 */
export default async function DocumentsSettingsPage() {
  const [t, tMine, tSettings, context] = await Promise.all([
    getTranslations("docBranding"),
    getTranslations("docBranding.mine"),
    getTranslations("partnerAccount.settings"),
    factoryContext(),
  ]);
  return (
    <PartnerPage
      full
      title={t("partnerTitle")}
      description={t("partnerBody")}
      back={{ href: "/settings", label: tSettings("title") }}
    >
      <SettingsFrame current="documents">
        {canAt(context, "factory_profile.read") ? (
          <DocumentBrandingEditor
            owner={{ zone: "partner", factoryId: context.factoryId }}
            canEdit={canAt(context, "factory_erp.configure")}
          />
        ) : null}
        <PartnerSection title={tMine("title")} description={tMine("body")} id="my-signature">
          <MySignatures zone="partner" />
        </PartnerSection>
      </SettingsFrame>
    </PartnerPage>
  );
}
