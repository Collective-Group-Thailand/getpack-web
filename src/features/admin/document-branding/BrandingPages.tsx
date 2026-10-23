"use client";

import { useTranslations } from "next-intl";

import { DocumentBrandingEditor } from "@/features/shared/document-branding/DocumentBrandingEditor";
import { MySignatures } from "@/features/shared/document-branding/MySignatures";
import { PageHeader } from "@/ui/components/PageHeader";

import { useCan } from "../console/actor";

/** getpack's logo, seal, signatories and signing rules (D-428, D-429; `document_branding.*`). */
export function DocumentBrandingPage() {
  const t = useTranslations("docBranding");
  const canEdit = useCan("document_branding.manage");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} description={t("body")} />
      <DocumentBrandingEditor owner={{ zone: "admin" }} canEdit={canEdit} />
    </div>
  );
}

/** The signed-in staff member's own signature (D-429). */
export function MySignaturePage() {
  const t = useTranslations("docBranding.mine");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} description={t("body")} />
      <MySignatures zone="admin" />
    </div>
  );
}
