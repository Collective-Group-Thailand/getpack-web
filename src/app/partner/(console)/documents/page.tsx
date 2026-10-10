import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_DOC_EXPIRY } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { FolderActions } from "@/features/partner/ops/DocumentForms";
import { ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.documents"))("title") };
}

const VIEWS = ["all", "expiring", "expired", "archived"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** The factory's documents (D-356): folders on the side, the list filtered by expiry, searchable. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string; folder?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "all";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const folderId = query.folder || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerOps.documents"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canManage = canAt(context, "factory_documents.manage");
  const read = await attempt(async () => {
    const [folders, list] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/documents/folders", { params: { path } }),
      contract.GET("/v1/partner/factories/{factoryId}/erp/documents", {
        params: {
          path,
          query: {
            perPage: PER_PAGE,
            page,
            ...(view === "expiring" || view === "expired" ? { expiry: view } : {}),
            ...(view === "archived" ? { status: "archived" as const } : {}),
            ...(folderId ? { folderId } : {}),
            ...(q ? { q } : {}),
          },
        },
      }),
    ]);
    return { folders: folders.data!, list: list.data! };
  });
  const href = (next: { view?: View; folder?: string | null; q?: string; page?: number }) => {
    const v = next.view ?? view;
    const f = next.folder === null ? undefined : (next.folder ?? folderId);
    return `/documents${queryOf({ view: v === "all" ? undefined : v, folder: f, q: next.q, page: next.page })}`;
  };
  const folder = read.data?.folders.find((f) => f.id === folderId);

  return (
    <PartnerPage
      full
      title={folder ? folder.name : t("title")}
      description={folder ? undefined : t("body")}
      {...(folder ? { back: { href: href({ folder: null }), label: t("allDocuments") } } : {})}
      actions={
        canManage ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href={`/documents/new${queryOf({ folder: folderId })}`}>{t("add")}</Link>
          </Button>
        ) : undefined
      }
    >
      {read.data ? (
        <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label={t("folders")} className="flex flex-col gap-2">
            <p className="text-muted text-sm font-semibold">{t("folders")}</p>
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {[{ id: "", name: t("allDocuments"), docCount: null as number | null }, ...read.data.folders].map((f) => {
                const current = (f.id || undefined) === folderId;
                return (
                  <li key={f.id || "all"} className="shrink-0">
                    <Link
                      href={href({ folder: f.id || null })}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                        current ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-surface-subtle",
                      )}
                    >
                      <Icon name="folder" size={16} />
                      <span className="truncate">{f.name}</span>
                      {f.docCount !== null ? (
                        <span className="text-muted ms-auto tabular-nums">{f.docCount}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {canManage ? <FolderActions {...(folder ? { folder } : {})} /> : null}
          </nav>
          <div className="flex min-w-0 flex-col gap-4">
            <ViewTabs
              label={t("views.label")}
              current={view}
              items={VIEWS.map((key) => ({ key, href: href({ view: key }), label: t(`views.${key}`) }))}
            />
            <SearchBar
              id="doc-q"
              action="/documents"
              hidden={{ view: view === "all" ? undefined : view, folder: folderId }}
              q={q}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              button={tCommon("search")}
            />
            <PartnerTable
              caption={t(`views.${view}`)}
              rows={read.data.list.data}
              rowKey={(d) => d.id}
              rowHref={(d) => `/documents/${d.id}`}
              rowTone={(d) => (d.expiry === "expired" ? "danger" : d.expiry === "expiring" ? "warning" : undefined)}
              empty={<EmptyState icon="folder" title={t("empty")} description={t("emptyBody")} />}
              columns={[
                { key: "title", header: t("table.title"), primary: true, cell: (d) => d.title },
                { key: "category", header: t("table.category"), cell: (d) => t(`categories.${d.category}`) },
                {
                  key: "link",
                  header: t("table.link"),
                  hideOnPhone: true,
                  cell: (d) => (d.link ? d.link.label : "—"),
                },
                {
                  key: "expires",
                  header: t("table.expires"),
                  className: "whitespace-nowrap",
                  cell: (d) =>
                    d.expiresOn ? (
                      <span className="flex items-center gap-2">
                        {format.date(d.expiresOn)}
                        <StatusChip map={ERP_DOC_EXPIRY} value={d.expiry} />
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "version",
                  header: t("table.version"),
                  align: "end",
                  hideOnPhone: true,
                  cell: (d) => t("versionLabel", { n: d.currentVersion }),
                },
                {
                  key: "updated",
                  header: t("table.updated"),
                  hideOnPhone: true,
                  className: "whitespace-nowrap",
                  cell: (d) => format.date(d.updatedAt),
                },
              ]}
            />
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={read.data.list.meta.total}
              hrefFor={(n) => href({ q, page: n > 1 ? n : undefined })}
              labels={{
                nav: tCommon("pagination.nav"),
                previous: tCommon("pagination.previous"),
                next: tCommon("pagination.next"),
                page: (n: number) => tCommon("pagination.page", { n }),
              }}
            />
          </div>
        </div>
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
