import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_ISSUED_STATUS, ERP_SALES_INVOICE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.invoices"))("title") };
}

const VIEWS = ["open", "overdue", "draft", "all", "notes"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * The factory's invoices and tax invoices to its customers (D-363): still owed first, overdue, drafts,
 * everything — and the credit / debit notes against them (D-364).
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.invoices"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const invoices =
    view === "notes"
      ? null
      : await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-invoices", {
                params: {
                  path,
                  query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
                },
              })
            ).data!,
        );
  const notes =
    view === "notes"
      ? await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-notes", {
                params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
              })
            ).data!,
        )
      : null;
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const counts = await viewTotals(VIEWS, async (key) =>
    key === "notes"
      ? (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-notes", {
            params: { path, query: { perPage: 1, ...(q ? { q } : {}) } },
          })
        ).data
      : (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-invoices", {
            params: { path, query: { perPage: 1, ...(key === "all" ? {} : { status: key }), ...(q ? { q } : {}) } },
          })
        ).data,
  );
  const canIssue = canAt(context, "factory_receivables.manage");
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/invoices${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;
  const labels = await pagerLabels();

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canIssue ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/invoices/new">{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key, { q }), label: t(`views.${key}`), count: counts[key] }))}
        />
        <SearchBar
          id="iv-q"
          action="/invoices"
          hidden={{ view: view === "open" ? undefined : view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      </ListToolbar>
      {invoices ? (
        invoices.data ? (
          <>
            <PartnerTable
              caption={t(`views.${view}`)}
              rows={invoices.data.data}
              rowKey={(row) => row.id}
              rowHref={(row) => `/invoices/${row.id}`}
              rowTone={(row) => (row.overdue ? "danger" : undefined)}
              empty={
                <EmptyState
                  icon="receipt"
                  title={t("empty")}
                  description={t("emptyBody")}
                  action={
                    view !== "all" ? (
                      <Button asChild variant="secondary" iconEnd="arrow-right">
                        <Link href={href("all")}>{t("views.all")}</Link>
                      </Button>
                    ) : canIssue ? (
                      <Button asChild variant="secondary" iconStart="plus">
                        <Link href="/invoices/new">{t("new")}</Link>
                      </Button>
                    ) : undefined
                  }
                />
              }
              columns={[
                {
                  key: "no",
                  header: t("table.no"),
                  primary: true,
                  cell: (row) =>
                    row.invoiceNo ? (
                      <span className="whitespace-nowrap tabular-nums">{row.invoiceNo}</span>
                    ) : (
                      <span className="text-muted">{tCommon("draftNo")}</span>
                    ),
                },
                { key: "customer", header: tCommon("customer"), cell: (row) => row.customer.name },
                {
                  key: "date",
                  header: tCommon("date"),
                  hideOnPhone: true,
                  className: "whitespace-nowrap",
                  cell: (row) => format.date(row.issueDate),
                },
                {
                  key: "due",
                  header: tCommon("due"),
                  className: "whitespace-nowrap",
                  cell: (row) => (
                    <span className="flex flex-wrap items-center gap-1">
                      {format.date(row.dueDate)}
                      {row.overdue ? <Badge tone="danger">{tCommon("overdue")}</Badge> : null}
                    </span>
                  ),
                },
                { key: "total", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.total) },
                {
                  key: "open",
                  header: tCommon("open"),
                  align: "end",
                  cell: (row) => format.thb(row.openAmount),
                },
                {
                  key: "status",
                  header: tCommon("status"),
                  cell: (row) => <StatusChip map={ERP_SALES_INVOICE_STATUS} value={row.status} />,
                },
              ]}
            />
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={invoices.data.meta.total}
              hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
              labels={labels}
            />
          </>
        ) : (
          <PageError error={invoices.error} />
        )
      ) : notes?.data ? (
        <>
          <PartnerTable
            caption={t("views.notes")}
            rows={notes.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/invoices/notes/${row.id}`}
            empty={
              <EmptyState
                icon="receipt"
                title={t("emptyNotes")}
                action={
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href={href("all")}>{t("views.all")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (row) =>
                  row.noteNo ? (
                    <span className="whitespace-nowrap tabular-nums">{row.noteNo}</span>
                  ) : (
                    <span className="text-muted">{tCommon("draftNo")}</span>
                  ),
              },
              { key: "kind", header: t("table.kind"), cell: (row) => t(`noteKinds.${row.kind}`) },
              { key: "customer", header: tCommon("customer"), cell: (row) => row.customer.name },
              {
                key: "invoice",
                header: t("table.invoice"),
                hideOnPhone: true,
                cell: (row) => <span className="tabular-nums">{row.invoice.invoiceNo}</span>,
              },
              { key: "total", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.total) },
              {
                key: "status",
                header: tCommon("status"),
                cell: (row) => <StatusChip map={ERP_ISSUED_STATUS} value={row.status} />,
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={notes.data.meta.total}
            hrefFor={(n) => href("notes", { q, page: n > 1 ? n : undefined })}
            labels={labels}
          />
        </>
      ) : (
        <PageError error={notes?.error} />
      )}
    </PartnerPage>
  );
}
