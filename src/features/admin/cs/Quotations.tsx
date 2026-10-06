"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { MEMO_STATUS, QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  problemMessage,
  QueryError,
  ResourceList,
  StatusChip,
  useActor,
  useCan,
  useProductTypes,
  type InitialPage,
} from "../console";
import { useFileDownload } from "../logistics/files";
import { memosList, quotationsList, type DiscountMemo, type Quotation } from "../orders/resources";
import { useQuotePdf } from "./pdf";

const CHANNELS = ["web", "cs", "line", "b2b"] as const;

/**
 * Saved quotations (`admin.quotes.*`). A quotation prices a configuration per quantity; it carries
 * no discount — CS gives one at checkout (D-052). Since v0.5.0 a row names its channel, the
 * customer's code and the RFQ it came from, and carries CS's internal note and its spec in words.
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
          {/* A code is issued at share or PDF; until then, say so rather than show part of a UUID. */}
          {row.quoteCode ?? <span className="text-muted font-sans font-normal">{t("noCode")}</span>}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.customer?.displayName ?? "—"}</p>
          {row.customerCode ? <p className="text-muted font-mono text-xs">{row.customerCode}</p> : null}
        </div>
      ),
    },
    { id: "productType", header: t("columns.product"), cell: (row) => labelOf(row.productTypeCode) },
    {
      id: "channel",
      header: t("columns.channel"),
      hideable: true,
      cell: (row) => (
        <div className="text-sm">
          <p>{t(`channels.${row.channel}`)}</p>
          {row.rfq ? (
            <Link href={`/rfq/${row.rfq.id}`} className="text-primary font-mono text-xs hover:underline">
              {row.rfq.rfqCode}
            </Link>
          ) : null}
        </div>
      ),
    },
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
        {
          id: "channel",
          label: t("columns.channel"),
          kind: "select",
          options: CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) })),
        },
      ]}
      empty={{ title: t("empty"), description: t("emptyBody") }}
    />
  );
}

export function QuotationDetail({ quoteId }: { quoteId: string }) {
  const t = useTranslations("cs.quotations");
  const locale = useLocale();
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
            items={[{ label: t("title"), href: "/quotations" }, { label: data.quoteCode ?? t("noCode") }]}
          />
        }
        title={data.quoteCode ? <span className="font-mono">{data.quoteCode}</span> : t("draftTitle")}
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
      <Card padding="lg">
        <DescriptionList
          columns={3}
          items={[
            { term: t("columns.customer"), description: data.customer?.displayName ?? "—" },
            {
              term: t("customerCode"),
              description: <span className="font-mono">{data.customerCode ?? "—"}</span>,
            },
            { term: t("columns.channel"), description: t(`channels.${data.channel}`) },
            ...(data.rfq
              ? [
                  {
                    term: t("rfq"),
                    description: (
                      <Link href={`/rfq/${data.rfq.id}`} className="text-primary font-mono hover:underline">
                        {data.rfq.rfqCode}
                      </Link>
                    ),
                  },
                ]
              : []),
            { term: t("createdBy"), description: data.createdBy?.displayName ?? "—" },
            ...(data.note ? [{ term: t("note"), description: data.note, wide: true }] : []),
          ]}
        />
      </Card>
      {data.summary.specs.length > 0 ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("specs")}</CardTitle>
          </CardHeader>
          <DescriptionList
            columns={3}
            items={data.summary.specs.map((spec) => ({
              term: locale === "en" ? spec.labelEn : spec.labelTh,
              description: locale === "en" ? spec.valueEn : spec.valueTh,
            }))}
          />
        </Card>
      ) : null}
      <DataTable caption={t("options")} showCaption columns={columns} rows={data.options} getRowId={(row) => row.id} />
    </div>
  );
}

/**
 * Discount memos (D-052, D-162). A memo prices the customer's CS cart when it is raised and is used
 * at checkout once approved; its evidence files open from the row, and "mine" is the API's
 * `requestedBy` filter (v0.5.0). It has no code of its own (CONTRACT-GAP admin.discount-memos: no
 * memo series decided).
 */
export function MemosList({ initial }: { initial: InitialPage<DiscountMemo> | null }) {
  const t = useTranslations("cs.memos");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const actor = useActor();
  const file = useFileDownload();
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
    {
      id: "evidence",
      header: t("columns.evidence"),
      hideable: true,
      cell: (row) =>
        row.evidence.length === 0 ? (
          "—"
        ) : (
          <ul className="flex flex-col gap-1">
            {row.evidence.map((evidence) => (
              <li key={evidence.id}>
                <Button
                  size="sm"
                  variant="link"
                  iconStart="paperclip"
                  className="h-auto p-0"
                  loading={file.isPending && file.variables === evidence.id}
                  onClick={() => file.mutate(evidence.id)}
                >
                  {evidence.originalName}
                </Button>
              </li>
            ))}
          </ul>
        ),
    },
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
        {
          id: "requestedBy",
          label: t("columns.requestedBy"),
          kind: "select",
          options: [{ value: actor.id, label: t("mine") }],
        },
      ]}
      rowTone={(row) => (row.belowMarginFloor ? "danger" : undefined)}
      empty={{ title: t("empty") }}
    />
  );
}
