"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { MEMO_STATUS, QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  problemMessage,
  QueryError,
  ResourceList,
  StatusChip,
  useCan,
  useProductTypes,
  type InitialPage,
} from "../console";
import { memosList, quotationsList, type DiscountMemo, type Quotation } from "../orders/resources";
import { useQuotePdf } from "./pdf";

/**
 * Saved quotations (`admin.quotes.*`). A quotation prices a configuration per quantity; it carries
 * no discount — CS gives one at checkout (D-052). The published quotation has no specs in words
 * (CONTRACT-GAP admin.quotations), so the page shows the prices it holds.
 */
export function QuotationsList({ initial }: { initial: InitialPage<Quotation> | null }) {
  const t = useTranslations("cs.quotations");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const columns: DataTableColumn<Quotation>[] = [
    {
      id: "quoteCode",
      header: t("columns.code"),
      sortable: true,
      cell: (row) => (
        <Link href={`/quotations/${row.id}`} className="text-primary font-mono font-medium hover:underline">
          {row.quoteCode ?? row.id.slice(0, 8)}
        </Link>
      ),
    },
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customer?.displayName ?? "—" },
    { id: "productType", header: t("columns.product"), cell: (row) => labelOf(row.productTypeCode) },
    {
      id: "quantities",
      header: t("columns.quantities"),
      numeric: true,
      cell: (row) => row.options.map((option) => format.number(option.quantity)).join(" / "),
    },
    {
      id: "grossAmount",
      header: t("columns.total"),
      numeric: true,
      cell: (row) => (row.options[0] ? format.thb(row.options[0].grossAmount) : "—"),
    },
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
  const { labelOf } = useProductTypes();
  const canOrder = useCan("carts.manage_on_behalf");
  const quote = useQuery({
    queryKey: queryKeys.detail("admin", "quote", quoteId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/quotes/{quoteId}", { params: { path: { quoteId } } })).data!,
  });
  const pdf = useQuotePdf(quoteId, (error) => toast.error(problemMessage(error, t("exportFailed"))));
  if (quote.isError) return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />;
  const data = quote.data;
  if (!data) return null;
  type Option = (typeof data.options)[number];
  const columns: DataTableColumn<Option>[] = [
    { id: "quantity", header: t("columns.quantity"), numeric: true, cell: (row) => format.number(row.quantity) },
    { id: "unitPrice", header: t("columns.unitPrice"), numeric: true, cell: (row) => format.thb(row.unitPrice) },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "vat", header: t("columns.vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
    { id: "gross", header: t("columns.total"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    {
      id: "lead",
      header: t("columns.lead"),
      cell: (row) => (row.leadTimeDays === null ? "—" : t("leadDays", { days: row.leadTimeDays })),
    },
    ...(canOrder && ["saved", "shared"].includes(data.status) && data.customer
      ? [
          {
            id: "order",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row: Option) => (
              <Button size="sm" asChild>
                <Link href={`/orders/new?quote=${data.id}&option=${row.id}`}>{t("createOrder")}</Link>
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
            items={[{ label: t("title"), href: "/quotations" }, { label: data.quoteCode ?? data.id.slice(0, 8) }]}
          />
        }
        title={<span className="font-mono">{data.quoteCode ?? data.id.slice(0, 8)}</span>}
        meta={<StatusChip map={QUOTE_STATUS} value={data.status} size="md" />}
        description={t("headline", {
          customer: data.customer?.displayName ?? "—",
          product: labelOf(data.productTypeCode),
          until: format.date(data.validUntil),
        })}
        actions={
          <Button variant="secondary" iconStart="download" loading={pdf.isPending} onClick={() => pdf.mutate()}>
            {t("exportPdf")}
          </Button>
        }
      />
      <DataTable caption={t("options")} showCaption columns={columns} rows={data.options} getRowId={(row) => row.id} />
    </div>
  );
}

/**
 * Discount memos (D-052, D-162). A memo prices the customer's CS cart when it is raised and is used
 * at checkout once approved. It has no code of its own (CONTRACT-GAP admin.discount-memos).
 */
export function MemosList({ initial }: { initial: InitialPage<DiscountMemo> | null }) {
  const t = useTranslations("cs.memos");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<DiscountMemo>[] = [
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customer?.displayName ?? "—" },
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
        row.approvalId ? (
          <Link href={`/approvals/${row.approvalId}`} className="text-primary text-sm hover:underline">
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
