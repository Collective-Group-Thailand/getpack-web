import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_DOC_EXPIRY } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerSection } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";

type LinkType = Schemas["ErpDocLink"];

/**
 * The documents linked to one record (D-356) — a supplier's certificates, a machine's manual, an order's
 * drawings — newest first, with their expiry; nothing shows for a user who may not read documents.
 */
export async function RelatedDocuments({ type, id, label }: { type: LinkType; id: string; label: string }) {
  const context = await factoryContext();
  if (!canAt(context, "factory_documents.read")) return null;
  const [t, format] = await Promise.all([getTranslations("partnerOps.documents"), getFormat()]);
  const { contract } = await partnerServerApis();
  const docs = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/documents", {
          params: { path: { factoryId: context.factoryId }, query: { linkType: type, linkId: id, perPage: 20 } },
        })
      ).data!,
  );
  if (!docs.data) return null;
  const canAdd = canAt(context, "factory_documents.manage");
  return (
    <PartnerSection
      title={t("relatedTitle")}
      actions={
        canAdd ? (
          <Button asChild size="sm" variant="secondary" iconStart="plus">
            <Link href={`/documents/new?linkType=${type}&linkId=${id}&label=${encodeURIComponent(label)}`}>
              {t("relatedAdd")}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {docs.data.data.length ? (
        <ul className="flex flex-col gap-2">
          {docs.data.data.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className="border-border bg-surface hover:bg-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{doc.title}</span>
                  <span className="text-muted text-sm">
                    {[t(`categories.${doc.category}` as never), doc.expiresOn ? format.date(doc.expiresOn) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <StatusChip map={ERP_DOC_EXPIRY} value={doc.expiry} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t("relatedEmpty")}</p>
      )}
    </PartnerSection>
  );
}
