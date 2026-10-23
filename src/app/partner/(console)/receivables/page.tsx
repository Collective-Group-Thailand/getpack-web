import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_RECEIPT_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.receivables"))("title") };
}

const VIEWS = ["aging", "receipts", "billing"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * What customers owe the factory (D-365): the aging by customer, the receipts and refunds, the billing notes.
 */
export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "aging";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.receivables"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/receivables${queryOf({ view: next === "aging" ? undefined : next, ...extra })}`;
  const labels = await pagerLabels();
  const manage = canAt(context, "factory_receivables.manage");

  let body: React.ReactNode;
  if (view === "aging") {
    const aging = await attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/receivables/aging", { params: { path } })).data!,
    );
    body = aging.data ? (
      <>
        <StatStrip
          label={t("aging.summary")}
          items={[
            { key: "total", label: t("aging.total"), value: format.thb(aging.data.totals.total) },
            { key: "current", label: t("aging.current"), value: format.thb(aging.data.totals.current) },
            {
              key: "overdue",
              label: t("aging.over90"),
              value: format.thb(aging.data.totals.over90),
              tone: aging.data.totals.over90 !== "0.00" ? "danger" : "neutral",
            },
            { key: "soon", label: t("aging.dueSoon"), value: format.thb(aging.data.dueSoon) },
            ...(aging.data.refundsDue !== "0.00"
              ? [
                  {
                    key: "refunds",
                    label: t("aging.refundsDue"),
                    value: format.thb(aging.data.refundsDue),
                    tone: "warning" as const,
                  },
                ]
              : []),
          ]}
        />
        <PartnerTable
          caption={t("aging.title", { date: format.date(aging.data.asOf) })}
          rows={aging.data.customers}
          rowKey={(row) => row.customer.id}
          rowHref={(row) => `/invoices?view=open&q=${encodeURIComponent(row.customer.code)}`}
          rowTone={(row) => (row.buckets.over90 !== "0.00" || row.buckets.d61_90 !== "0.00" ? "danger" : undefined)}
          empty={<EmptyState icon="coins" title={t("aging.empty")} />}
          columns={[
            { key: "c", header: tCommon("customer"), primary: true, cell: (row) => row.customer.name },
            {
              key: "cur",
              header: t("aging.current"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.current),
            },
            {
              key: "b1",
              header: t("aging.d1_30"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.d1_30),
            },
            {
              key: "b2",
              header: t("aging.d31_60"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.d31_60),
            },
            {
              key: "b3",
              header: t("aging.d61_90"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.buckets.d61_90),
            },
            { key: "b4", header: t("aging.over90"), align: "end", cell: (row) => format.thb(row.buckets.over90) },
            {
              key: "t",
              header: t("aging.total"),
              align: "end",
              cell: (row) => <strong>{format.thb(row.buckets.total)}</strong>,
            },
          ]}
        />
      </>
    ) : (
      <PageError error={aging.error} />
    );
  } else if (view === "receipts") {
    const list = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/receipts", {
            params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
          })
        ).data!,
    );
    body = list.data ? (
      <>
        <PartnerTable
          caption={t("views.receipts")}
          rows={list.data.data}
          rowKey={(row) => row.id}
          rowHref={(row) => `/receivables/receipts/${row.id}`}
          empty={<EmptyState icon="coins" title={t("receiptsEmpty")} />}
          columns={[
            {
              key: "no",
              header: t("table.no"),
              primary: true,
              cell: (row) => <span className="font-mono whitespace-nowrap">{row.receiptNo}</span>,
            },
            { key: "kind", header: t("table.kind"), cell: (row) => t(`kinds.${row.kind}`) },
            { key: "c", header: tCommon("customer"), cell: (row) => row.customer.name },
            {
              key: "d",
              header: tCommon("date"),
              className: "whitespace-nowrap",
              cell: (row) => format.date(row.receivedOn),
            },
            { key: "a", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.amount) },
            {
              key: "w",
              header: t("table.wht"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.whtAmount),
            },
            {
              key: "s",
              header: tCommon("status"),
              cell: (row) => <StatusChip map={ERP_RECEIPT_STATUS} value={row.status} />,
            },
          ]}
        />
        <Pager
          page={page}
          perPage={PER_PAGE}
          total={list.data.meta.total}
          hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
          labels={labels}
        />
      </>
    ) : (
      <PageError error={list.error} />
    );
  } else {
    const list = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/billing-notes", {
            params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
          })
        ).data!,
    );
    body = list.data ? (
      <>
        <PartnerTable
          caption={t("views.billing")}
          rows={list.data.data}
          rowKey={(row) => row.id}
          rowHref={(row) => `/receivables/billing/${row.id}`}
          empty={<EmptyState icon="document" title={t("billingEmpty")} />}
          columns={[
            {
              key: "no",
              header: t("table.no"),
              primary: true,
              cell: (row) => <span className="font-mono whitespace-nowrap">{row.billingNo}</span>,
            },
            { key: "c", header: tCommon("customer"), cell: (row) => row.customer.name },
            {
              key: "d",
              header: tCommon("date"),
              className: "whitespace-nowrap",
              cell: (row) => format.date(row.billingDate),
            },
            {
              key: "col",
              header: t("table.collectOn"),
              hideOnPhone: true,
              cell: (row) => (row.collectOn ? format.date(row.collectOn) : "—"),
            },
            { key: "a", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.total) },
            {
              key: "s",
              header: tCommon("status"),
              cell: (row) => <StatusChip map={ERP_RECEIPT_STATUS} value={row.status} />,
            },
          ]}
        />
        <Pager
          page={page}
          perPage={PER_PAGE}
          total={list.data.meta.total}
          hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
          labels={labels}
        />
      </>
    ) : (
      <PageError error={list.error} />
    );
  }

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        manage ? (
          <>
            <Button asChild size="lg" iconStart="coins">
              <Link href="/receivables/receipts/new">{t("newReceipt")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" iconStart="document">
              <Link href="/receivables/billing/new">{t("newBilling")}</Link>
            </Button>
          </>
        ) : undefined
      }
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      {view !== "aging" ? (
        <SearchBar
          id="ar-q"
          action="/receivables"
          hidden={{ view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      ) : null}
      {body}
    </PartnerPage>
  );
}
