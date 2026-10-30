import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_DOC_EXPIRY } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { FolderActions } from "@/features/partner/ops/DocumentForms";
import { FilterLinks, ListToolbar, ViewTabs } from "@/features/partner/rows";
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
  const totals = read.data
    ? await viewTotals(
        VIEWS,
        async (key) =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/documents", {
              params: {
                path,
                query: {
                  perPage: 1,
                  ...(key === "expiring" || key === "expired" ? { expiry: key } : {}),
                  ...(key === "archived" ? { status: "archived" as const } : {}),
                  ...(folderId ? { folderId } : {}),
                  ...(q ? { q } : {}),
                },
              },
            })
          ).data,
      )
    : null;
  const href = (next: { view?: View; folder?: string | null; q?: string; page?: number }) => {
    const v = next.view ?? view;
    const f = next.folder === null ? undefined : (next.folder ?? folderId);
    return `/documents${queryOf({ view: v === "all" ? undefined : v, folder: f, q: next.q, page: next.page })}`;
  };
  const folder = read.data?.folders.find((f) => f.id === folderId);
  const folderItems = [
    { id: "", name: t("allDocuments"), docCount: null as number | null },
    ...(read.data?.folders ?? []),
  ];

  return (
    <PartnerPage
      full
      title={folder ? folder.name : t("title")}
      description={folder ? undefined : t("body")}
      {...(folder ? { back: { href: href({ folder: null }), label: t("allDocuments") } } : {})}
      actions={
        canManage ? (
          <Button asChild iconStart="plus">
            <Link href={`/documents/new${queryOf({ folder: folderId })}`}>{t("add")}</Link>
          </Button>
        ) : undefined
      }
    >
      {read.data ? (
        <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
          {/* Folders: a side list on a desk; on a phone a wrapping filter line under the toolbar instead. */}
          <nav aria-label={t("folders")} className="hidden flex-col gap-2 lg:sticky lg:top-20 lg:flex">
            <p className="text-muted px-3 text-sm font-medium">{t("folders")}</p>
            <ul className="flex flex-col gap-0.5">
              {folderItems.map((f) => {
                const current = (f.id || undefined) === folderId;
                return (
                  <li key={f.id || "all"}>
                    <Link
                      href={href({ folder: f.id || null })}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "focus-visible:ring-focus-ring flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm outline-none focus-visible:ring-2",
                        current
                          ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                          : "text-fg hover:bg-surface-subtle",
                      )}
                    >
                      <Icon name="folder" size={16} aria-hidden="true" className={current ? undefined : "text-muted"} />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {f.docCount !== null ? (
                        <span className={cn("text-xs tabular-nums", current ? undefined : "text-muted")}>
                          {f.docCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {canManage ? (
              <div className="border-border mt-2 border-t px-1 pt-3">
                <FolderActions {...(folder ? { folder } : {})} />
              </div>
            ) : null}
          </nav>
          <div className="flex min-w-0 flex-col gap-4">
            <ListToolbar>
              <ViewTabs
                label={t("views.label")}
                current={view}
                items={VIEWS.map((key) => ({
                  key,
                  href: href({ view: key, q }),
                  label: t(`views.${key}`),
                  count: totals?.[key] ?? null,
                }))}
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
            </ListToolbar>
            {folderItems.length > 1 || canManage ? (
              <div className="flex flex-col gap-2 lg:hidden">
                {folderItems.length > 1 ? (
                  <FilterLinks
                    label={t("folders")}
                    current={folderId ?? ""}
                    items={folderItems.map((f) => ({ key: f.id, href: href({ folder: f.id || null }), label: f.name }))}
                  />
                ) : null}
                {canManage ? <FolderActions {...(folder ? { folder } : {})} /> : null}
              </div>
            ) : null}
            <PartnerTable
              caption={t(`views.${view}`)}
              rows={read.data.list.data}
              rowKey={(d) => d.id}
              rowHref={(d) => `/documents/${d.id}`}
              rowTone={(d) => (d.expiry === "expired" ? "danger" : d.expiry === "expiring" ? "warning" : undefined)}
              empty={
                <EmptyState
                  icon="folder"
                  title={t("empty")}
                  description={t("emptyBody")}
                  action={
                    canManage ? (
                      <Button asChild variant="secondary" iconStart="plus">
                        <Link href={`/documents/new${queryOf({ folder: folderId })}`}>{t("add")}</Link>
                      </Button>
                    ) : (
                      <Button asChild variant="secondary">
                        <Link href="/documents">{t("allDocuments")}</Link>
                      </Button>
                    )
                  }
                />
              }
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
