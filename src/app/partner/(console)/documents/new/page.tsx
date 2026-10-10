import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { docLinkTargets } from "@/features/partner/ops/doc-server";
import { DocumentForm } from "@/features/partner/ops/DocumentForms";
import type { Schemas } from "@/lib/api/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.documents"))("newTitle") };
}

const LINKS = [
  "trading_partner",
  "item",
  "machine",
  "purchase_order",
  "production_order",
  "maintenance_order",
] as const satisfies readonly Schemas["ErpDocLink"][];

/** Add a document (D-356); from a record's page the link comes pre-filled. */
export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ linkType?: string; linkId?: string; label?: string; folder?: string }>;
}) {
  const [query, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerOps.documents"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [folders, targets] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/documents/folders", {
        params: { path: { factoryId: context.factoryId } },
      }),
      docLinkTargets(),
    ]);
    return { folders: folders.data!, targets };
  });
  const linkType = LINKS.find((l) => l === query.linkType);
  const prefill = {
    ...(linkType && query.linkId
      ? { linkType, linkId: query.linkId, label: query.label ?? t(`links.${linkType}`) }
      : {}),
    ...(query.folder ? { folderId: query.folder } : {}),
  };
  return (
    <PartnerPage title={t("newTitle")} back={{ href: "/documents", label: t("title") }}>
      {read.data ? (
        <DocumentForm folders={read.data.folders} targets={read.data.targets} prefill={prefill} />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
