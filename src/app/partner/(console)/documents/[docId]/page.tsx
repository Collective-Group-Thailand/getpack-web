import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_DOC_EXPIRY } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { docLinkTargets } from "@/features/partner/ops/doc-server";
import { ArchiveDocButton, DocumentForm, NewVersionButton, OpenFileButton } from "@/features/partner/ops/DocumentForms";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Panel } from "@/ui/components/Panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.documents"))("title") };
}

const LINK_HREF: Record<Schemas["ErpDocLink"], (id: string) => string> = {
  trading_partner: (id) => `/partners/${id}`,
  item: (id) => `/stock/items/${id}`,
  machine: (id) => `/machines/${id}`,
  purchase_order: (id) => `/purchasing/${id}`,
  production_order: (id) => `/planning/orders/${id}`,
  maintenance_order: (id) => `/maintenance/${id}`,
};

/** One document (D-356): its details, every version with a way to open it, and — for a manager — edits. */
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ docId }, query, t, tShared, tCommon, format, context] = await Promise.all([
    params,
    searchParams,
    getTranslations("partnerOps.documents"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/documents/{docId}", {
      params: { path: { ...path, docId } },
    });
    return { doc: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/documents", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { doc, etag } = read.data;
  const canManage = canAt(context, "factory_documents.manage");
  const editing =
    canManage && query.edit === "1"
      ? await attempt(async () => {
          const [folders, targets] = await Promise.all([
            contract.GET("/v1/partner/factories/{factoryId}/erp/documents/folders", { params: { path } }),
            docLinkTargets(),
          ]);
          return { folders: folders.data!, targets };
        })
      : null;
  const docBack = doc.folder ? { href: `/documents?folder=${doc.folder.id}`, label: doc.folder.name } : back;

  // `?edit=1`: the same record as a form (the ERP edit pattern), back to the record when saved.
  if (editing)
    return (
      <PartnerPage
        wide
        title={t("editTitle", { title: doc.title })}
        back={{ href: `/documents/${doc.id}`, label: doc.title }}
      >
        {editing.data ? (
          <DocumentForm folders={editing.data.folders} targets={editing.data.targets} doc={doc} etag={etag} />
        ) : (
          <PageError error={editing.error} />
        )}
      </PartnerPage>
    );

  const current = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions[0];
  return (
    <PartnerPage
      wide
      title={doc.title}
      back={docBack}
      status={
        doc.status === "archived" ? (
          <Badge tone="neutral">{t("views.archived")}</Badge>
        ) : doc.expiresOn ? (
          <StatusChip map={ERP_DOC_EXPIRY} value={doc.expiry} size="md" />
        ) : null
      }
      meta={<span className="text-muted text-sm">{t(`categories.${doc.category}`)}</span>}
    >
      <PartnerDetail
        aside={
          <ActionPanel
            id="doc-actions"
            tone="neutral"
            title={t("versionLabel", { n: doc.currentVersion })}
            description={
              current
                ? [current.file.name, format.bytes(current.file.sizeBytes), format.date(current.createdAt)]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          >
            <div data-fill="row" className="flex flex-col gap-2">
              <OpenFileButton fileId={doc.file.id} label={t("download")} variant="primary" size="lg" />
              {canManage && doc.status === "active" ? <NewVersionButton doc={doc} variant="secondary" /> : null}
              {canManage ? (
                <Button asChild variant="secondary" iconStart="edit">
                  <Link href={`/documents/${doc.id}?edit=1`}>{t("edit")}</Link>
                </Button>
              ) : null}
              {canManage ? <ArchiveDocButton doc={doc} etag={etag} /> : null}
            </div>
          </ActionPanel>
        }
      >
        <Panel id="doc-facts" title={tCommon("sections.details")}>
          <DescriptionList
            items={[
              { term: t("facts.category"), description: t(`categories.${doc.category}`) },
              ...(doc.folder ? [{ term: t("facts.folder"), description: doc.folder.name }] : []),
              ...(doc.link
                ? [
                    {
                      term: t("facts.link"),
                      description: (
                        <Link
                          href={LINK_HREF[doc.link.type](doc.link.id)}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {tShared("labelled", { label: t(`links.${doc.link.type}`), value: doc.link.label })}
                        </Link>
                      ),
                    },
                  ]
                : []),
              {
                term: t("facts.expires"),
                description: doc.expiresOn ? format.date(doc.expiresOn) : "—",
              },
              ...(doc.expiresOn
                ? [{ term: t("facts.remind"), description: t("facts.remindDays", { n: doc.remindDays }) }]
                : []),
              ...(doc.tags.length ? [{ term: t("facts.tags"), description: doc.tags.join(", ") }] : []),
              ...(doc.note ? [{ term: t("facts.note"), description: doc.note }] : []),
            ]}
          />
        </Panel>

        <PartnerSection id="versions" title={t("versionsTitle")} description={t("versionsBody")}>
          <ol className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
            {doc.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    {t("versionLabel", { n: v.version })}
                    {v.version === doc.currentVersion ? <Badge tone="success">{t("current")}</Badge> : null}
                  </span>
                  <span className="text-muted text-sm [overflow-wrap:anywhere]">
                    {[v.file.name, format.bytes(v.file.sizeBytes), format.dateTime(v.createdAt), v.by]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {v.note ? <span className="text-sm">{v.note}</span> : null}
                </span>
                <OpenFileButton fileId={v.file.id} label={t("download")} />
              </li>
            ))}
          </ol>
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
