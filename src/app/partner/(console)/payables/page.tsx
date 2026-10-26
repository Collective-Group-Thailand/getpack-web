import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_SUPPLIER_INVOICE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables"))("title") };
}

const VIEWS = ["open", "overdue", "all", "payments", "aging"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * What the factory owes its suppliers (D-337, D-338): open invoices by due date, the overdue, everything,
 * payments made, and the aging by supplier — with the totals from the API on top.
 */
export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerFactory.payables"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [aging, invoices, payments] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-invoices/aging", { params: { path } }))
          .data!,
    ),
    view === "open" || view === "overdue" || view === "all"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-invoices", {
                params: {
                  path,
                  query: {
                    perPage: PER_PAGE,
                    page,
                    ...(view === "open" ? { status: "open" } : view === "overdue" ? { overdue: true } : {}),
                    ...(q ? { q } : {}),
                  },
                },
              })
            ).data!,
        )
      : null,
    view === "payments"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-payments", {
                params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
              })
            ).data!,
        )
      : null,
  ]);
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/payables${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;
  const pagination = {
    nav: tCommon("pagination.nav"),
    previous: tCommon("pagination.previous"),
    next: tCommon("pagination.next"),
    page: (n: number) => tCommon("pagination.page", { n }),
  };
  const canManage = canAt(context, "factory_ap.manage");
  const totals = aging.data?.totals;
  const overdue = totals
    ? [totals.d1_30, totals.d31_60, totals.d61_90, totals.over90].some((v) => v !== "0.00")
    : false;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canManage ? (
          <>
            <Button asChild size="lg" iconStart="plus">
              <Link href="/payables/invoices/new">{t("newInvoice")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" iconStart="coins">
              <Link href="/payables/payments/new">{t("newPayment")}</Link>
            </Button>
          </>
        ) : undefined
      }
    >
      {totals ? (
        <StatStrip
          label={t("stats.label")}
          items={[
            { key: "total", label: t("stats.open"), value: format.thb(totals.total) },
            { key: "soon", label: t("stats.dueSoon"), value: format.thb(aging.data!.dueSoon), tone: "warning" },
            {
              key: "late",
              label: t("stats.late"),
              value: format.thb(totals.d1_30),
              hint: overdue ? t("stats.overdueHint") : undefined,
              tone: overdue ? "danger" : undefined,
              href: href("overdue"),
            },
            { key: "current", label: t("stats.current"), value: format.thb(totals.current) },
          ]}
        />
      ) : null}
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      {view !== "aging" ? (
        <SearchBar
          id="ap-q"
          action="/payables"
          hidden={{ view: view === "open" ? undefined : view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      ) : null}
      {invoices ? (
        invoices.data ? (
          <>
            <PartnerTable
              caption={t(`views.${view}`)}
              rows={invoices.data.data}
              rowKey={(inv) => inv.id}
              rowHref={(inv) => `/payables/invoices/${inv.id}`}
              rowTone={(inv) => (inv.overdue ? "danger" : undefined)}
              empty={<EmptyState icon="receipt" title={t("empty")} description={t("emptyBody")} />}
              columns={[
                {
                  key: "no",
                  header: t("table.no"),
                  primary: true,
                  cell: (inv) => (
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap tabular-nums">{inv.docNo}</span>
                      <span className="text-muted text-sm">{inv.invoiceNo}</span>
                    </span>
                  ),
                },
                { key: "supplier", header: t("table.supplier"), cell: (inv) => inv.supplier.name },
                {
                  key: "due",
                  header: t("table.due"),
                  className: "whitespace-nowrap",
                  cell: (inv) => (
                    <span className="flex flex-wrap items-center gap-1">
                      {format.date(inv.dueDate)}
                      {inv.overdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
                    </span>
                  ),
                },
                {
                  key: "total",
                  header: t("table.total"),
                  align: "end",
                  hideOnPhone: true,
                  cell: (inv) => format.thb(inv.total),
                },
                {
                  key: "open",
                  header: t("table.outstanding"),
                  align: "end",
                  cell: (inv) => format.thb(inv.outstanding),
                },
                {
                  key: "status",
                  header: t("table.status"),
                  cell: (inv) => <StatusChip map={ERP_SUPPLIER_INVOICE_STATUS} value={inv.status} />,
                },
              ]}
            />
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={invoices.data.meta.total}
              hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
              labels={pagination}
            />
          </>
        ) : (
          <PageError error={invoices.error} />
        )
      ) : payments ? (
        payments.data ? (
          <>
            <PartnerTable
              caption={t("views.payments")}
              rows={payments.data.data}
              rowKey={(p) => p.id}
              rowHref={(p) => `/payables/payments/${p.id}`}
              empty={<EmptyState icon="coins" title={t("emptyPayments")} />}
              columns={[
                {
                  key: "no",
                  header: t("table.paymentNo"),
                  primary: true,
                  cell: (p) => <span className="tabular-nums">{p.paymentNo}</span>,
                },
                {
                  key: "date",
                  header: t("table.paidOn"),
                  className: "whitespace-nowrap",
                  cell: (p) => format.date(p.paidOn),
                },
                { key: "supplier", header: t("table.supplier"), cell: (p) => p.supplier.name },
                {
                  key: "method",
                  header: t("table.method"),
                  hideOnPhone: true,
                  cell: (p) => t(`pay.methods.${p.method}` as never),
                },
                {
                  key: "amount",
                  header: t("table.amount"),
                  align: "end",
                  cell: (p) => (
                    <span className={p.amount.startsWith("-") ? "text-danger" : undefined}>{format.thb(p.amount)}</span>
                  ),
                },
                {
                  key: "flags",
                  header: t("table.status"),
                  cell: (p) =>
                    p.reverses ? (
                      <Badge tone="danger">{t("reversal", { no: p.reverses.code })}</Badge>
                    ) : p.reversedBy ? (
                      <Badge tone="neutral">{t("reversed")}</Badge>
                    ) : null,
                },
              ]}
            />
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={payments.data.meta.total}
              hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
              labels={pagination}
            />
          </>
        ) : (
          <PageError error={payments.error} />
        )
      ) : aging.data ? (
        <PartnerTable
          caption={t("views.aging")}
          rows={aging.data.suppliers}
          rowKey={(row) => row.supplier.id}
          rowHref={(row) => `/partners/${row.supplier.id}`}
          empty={<EmptyState icon="check" title={t("nothingOwed")} />}
          columns={[
            { key: "supplier", header: t("table.supplier"), primary: true, cell: (row) => row.supplier.name },
            {
              key: "current",
              header: t("aging.current"),
              align: "end",
              cell: (row) => format.thb(row.buckets.current),
            },
            { key: "d1", header: t("aging.d1_30"), align: "end", cell: (row) => format.thb(row.buckets.d1_30) },
            {
              key: "d31",
              header: t("aging.d31_60"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.d31_60),
            },
            {
              key: "d61",
              header: t("aging.d61_90"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.d61_90),
            },
            {
              key: "d90",
              header: t("aging.over90"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.over90),
            },
            {
              key: "total",
              header: t("aging.total"),
              align: "end",
              cell: (row) => <strong>{format.thb(row.buckets.total)}</strong>,
            },
          ]}
        />
      ) : (
        <PageError error={aging.error} />
      )}
    </PartnerPage>
  );
}
