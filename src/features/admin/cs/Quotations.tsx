"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

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
import { cn } from "@/ui/lib/cn";

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
  const canOrder = useCan("carts.manage_on_behalf");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  // Six columns (UX audit, /quotations): the code with its product, the customer, quantities, the
  // total, the status, and how long it holds — the channel and the date kept one click away.
  const columns: DataTableColumn<Quotation>[] = [
    {
      id: "quoteCode",
      header: t("columns.code"),
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/quotations/${row.id}`}
            className="text-primary font-mono font-medium whitespace-nowrap hover:underline"
          >
            {/* A code is issued at share or PDF; until then, say so rather than show part of a UUID. */}
            {row.quoteCode ?? <span className="text-muted font-sans font-normal">{t("noCode")}</span>}
          </Link>
          <p className="text-muted truncate text-xs">{labelOf(row.productTypeCode)}</p>
        </div>
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
      cell: (row) => (
        <span className="whitespace-nowrap">
          {row.options.map((option) => format.number(option.quantity)).join(" / ")}
        </span>
      ),
    },
    {
      id: "grossAmount",
      header: t("columns.total"),
      numeric: true,
      cell: (row) => (row.options[0] ? format.thb(row.options[0].grossAmount) : "—"),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={QUOTE_STATUS} value={row.status} /> },
    { id: "validUntil", header: t("columns.validUntil"), cell: (row) => <ValidUntil date={row.validUntil} /> },
    {
      id: "createdAt",
      header: t("columns.created"),
      sortable: true,
      hideable: true,
      cell: (row) => <When at={row.createdAt} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) => (
        <span className="flex justify-end gap-1">
          {canOrder && (row.status === "saved" || row.status === "shared") ? (
            <Button asChild size="sm" variant="ghost" iconStart="cart">
              <Link href={`/orders/new?quote=${row.id}`}>{t("toOrder")}</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost" iconStart="document">
            <Link href={`/quotations/${row.id}`}>{t("open")}</Link>
          </Button>
        </span>
      ),
    },
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
      rowHref={(row) => `/quotations/${row.id}`}
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
      // A memo is asked for while CS builds an order for a customer (its discount step), so the
      // way to make one starts there (UX audit: the page had no way to create one).
      empty={{
        title: t("empty"),
        description: t("emptyBody"),
        action: (
          <Button asChild iconStart="plus">
            <Link href="/cs">{t("create")}</Link>
          </Button>
        ),
      }}
    />
  );
}

/** "ใช้ได้ถึง" on one line, amber within three days and red once it has lapsed (UX audit). */
function ValidUntil({ date }: { date: string | null }) {
  const format = useFormat();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  if (!date) return <span className="text-muted">–</span>;
  const days = Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  return (
    <span
      className={cn(
        "whitespace-nowrap",
        days < 0 ? "text-danger-subtle-fg font-semibold" : days < 3 ? "text-warning-subtle-fg font-medium" : undefined,
      )}
    >
      {format.date(date, { style: date.slice(0, 4) === today.slice(0, 4) ? "dayMonth" : "short" })}
    </span>
  );
}
