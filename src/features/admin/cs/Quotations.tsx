"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { MEMO_STATUS, QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import { download, problemMessage, QueryError, ResourceList, StatusChip, useCan, type InitialPage } from "../console";
import { memosList, quotationsList, type DiscountMemo, type QuotationSummary } from "../orders/resources";

export function QuotationsList({ initial }: { initial: InitialPage<QuotationSummary> | null }) {
  const t = useTranslations("cs.quotations");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<QuotationSummary>[] = [
    {
      id: "quoteCode",
      header: t("columns.code"),
      sortable: true,
      cell: (row) => (
        <Link href={`/quotations/${row.id}`} className="text-primary font-mono font-medium hover:underline">
          {row.quoteCode}
        </Link>
      ),
    },
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customer.displayName },
    { id: "productType", header: t("columns.product"), cell: (row) => row.productType.name },
    {
      id: "quantities",
      header: t("columns.quantities"),
      numeric: true,
      cell: (row) => row.quantities.map((quantity) => format.number(quantity)).join(" / "),
    },
    { id: "grossAmount", header: t("columns.total"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={QUOTE_STATUS} value={row.status} /> },
    { id: "validUntil", header: t("columns.validUntil"), cell: (row) => format.date(row.validUntil) },
    { id: "createdAt", header: t("columns.created"), sortable: true, cell: (row) => <When at={row.createdAt} /> },
  ];
  return (
    <ResourceList
      resource={quotationsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      exportable
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: Object.entries(QUOTE_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
        },
      ]}
      empty={{ title: t("empty"), description: t("emptyBody") }}
    />
  );
}

export function QuotationDetail({ quoteId }: { quoteId: string }) {
  const t = useTranslations("cs.quotations");
  const format = useFormat();
  const canOrder = useCan("carts.manage_on_behalf");
  const quote = useQuery({
    queryKey: queryKeys.detail("admin", "quote", quoteId),
    queryFn: () => browserRequests().call("GET /v1/admin/quotations/{quoteId}", { path: { quoteId } }),
  });
  const exportPdf = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/quotations/{quoteId}/actions/export-pdf", { path: { quoteId } }),
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("exportFailed"))),
  });
  if (quote.isError) return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />;
  const data = quote.data;
  if (!data) return null;
  const columns: DataTableColumn<(typeof data.options)[number]>[] = [
    { id: "quantity", header: t("columns.quantity"), numeric: true, cell: (row) => format.number(row.quantity) },
    { id: "unitPrice", header: t("columns.unitPrice"), numeric: true, cell: (row) => format.thb(row.unitPrice) },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "discount", header: t("columns.discount"), numeric: true, cell: (row) => format.thb(row.discountAmount) },
    { id: "vat", header: t("columns.vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
    { id: "gross", header: t("columns.total"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "lead", header: t("columns.lead"), cell: (row) => t("leadDays", { days: row.leadTimeDays }) },
    ...(canOrder && ["saved", "shared"].includes(data.status)
      ? [
          {
            id: "order",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row: (typeof data.options)[number]) => (
              <Button size="sm" asChild>
                <Link href={`/orders/new?quote=${data.id}&quantity=${row.quantity}`}>{t("createOrder")}</Link>
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/quotations" }, { label: data.quoteCode }]}
          />
        }
        title={<span className="font-mono">{data.quoteCode}</span>}
        meta={<StatusChip map={QUOTE_STATUS} value={data.status} size="md" />}
        description={t("headline", { customer: data.customer.displayName, until: format.date(data.validUntil) })}
        actions={
          <Button
            variant="secondary"
            iconStart="download"
            loading={exportPdf.isPending}
            onClick={() => exportPdf.mutate()}
          >
            {t("exportPdf")}
          </Button>
        }
      />
      <Card padding="lg">
        <CardHeader>
          <CardTitle>{t("specs")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={3}
          items={data.specs.map((spec) => ({ term: spec.label, description: spec.value }))}
        />
        {data.discount ? (
          <p className="mt-3 text-sm">
            {t("discount", { pct: format.percent(data.discount.pct) })}
            {data.discount.memo ? (
              <span className="ms-2">
                <StatusChip map={MEMO_STATUS} value={data.discount.memo.status} />
              </span>
            ) : null}
          </p>
        ) : null}
      </Card>
      <DataTable
        caption={t("options")}
        showCaption
        columns={columns}
        rows={data.options}
        getRowId={(row) => String(row.quantity)}
      />
    </div>
  );
}

export function MemosList({ initial }: { initial: InitialPage<DiscountMemo> | null }) {
  const t = useTranslations("cs.memos");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<DiscountMemo>[] = [
    {
      id: "memoCode",
      header: t("columns.code"),
      cell: (row) => <span className="font-mono font-medium">{row.memoCode}</span>,
    },
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customer.displayName },
    { id: "orderValue", header: t("columns.orderValue"), numeric: true, cell: (row) => format.thb(row.orderValue) },
    {
      id: "requestedPct",
      header: t("columns.requested"),
      numeric: true,
      cell: (row) => `${format.percent(row.requestedPct)} · ${format.thb(row.requestedAmount)}`,
    },
    {
      id: "margin",
      header: t("columns.margin"),
      numeric: true,
      cell: (row) =>
        row.resultingMarginPct ? (
          <span className={row.belowMarginFloor ? "text-danger font-medium" : undefined}>
            {format.percent(row.resultingMarginPct)}
          </span>
        ) : (
          "—"
        ),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={MEMO_STATUS} value={row.status} /> },
    { id: "requestedBy", header: t("columns.requestedBy"), cell: (row) => row.requestedBy.displayName },
    { id: "validUntil", header: t("columns.validUntil"), cell: (row) => format.date(row.validUntil) },
    {
      id: "approval",
      header: <span className="sr-only">{t("columns.approval")}</span>,
      cell: (row) =>
        row.approvalRequestId ? (
          <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary text-sm hover:underline">
            {t("openApproval")}
          </Link>
        ) : null,
    },
  ];
  return (
    <ResourceList
      resource={memosList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: Object.entries(MEMO_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
        },
      ]}
      rowTone={(row) => (row.belowMarginFloor ? "danger" : undefined)}
      empty={{ title: t("empty") }}
    />
  );
}
