"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { moneyText } from "@/domain/money";
import {
  BANK_ACCOUNT_STATUS,
  BILLING_STATEMENT_STATUS,
  INPUT_VAT_STATUS,
  PAYABLE_STATUS,
  PURCHASE_ORDER_STATUS,
  VENDOR_BILL_STATUS,
} from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { NextActionBar } from "../console/NextActionBar";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import {
  billingStatementsList,
  goodsReceiptsList,
  PAYABLE_STATUSES,
  payablesList,
  PO_STATUSES,
  purchaseOrdersList,
  VENDOR_BILL_STATUSES,
  vendorInvoicesList,
  type BillingStatement,
  type GoodsReceipt,
  type PayableItem,
  type PurchaseOrder,
  type Vendor,
  type VendorInvoice,
} from "./resources";
import { AccountNo, fieldErrorsOf, SourceJournals } from "./shared";
import { invalidateMoney } from "./slips";

/** The AP desk's pages side by side. */
export function PayablesNav() {
  const t = useTranslations("finance.payables.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/payables", label: t("open"), exact: true },
        { href: "/finance/payables/purchase-orders", label: t("purchaseOrders") },
        { href: "/finance/payables/goods-receipts", label: t("goodsReceipts") },
        { href: "/finance/payables/statements", label: t("statements") },
        { href: "/finance/payables/invoices", label: t("invoices") },
        { href: "/finance/payables/vendors", label: t("vendors") },
      ]}
    />
  );
}

/** Vendors by id (factories and the others), to name a row that carries only an id. */
export function useVendors() {
  return useQuery({
    queryKey: queryKeys.list("admin", "vendor"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/vendors", {})).data!,
    staleTime: 5 * 60_000,
  });
}

function VendorLink({ id, name }: { id: string; name?: string }) {
  const vendors = useVendors();
  const label = name ?? vendors.data?.find((vendor) => vendor.id === id)?.legalName ?? id.slice(0, 8);
  return (
    <Link href={`/finance/payables/vendors/${id}`} className="text-primary hover:underline">
      {label}
    </Link>
  );
}

/**
 * AP open items (§6): net and VAT separately, and the date each becomes payable under the payout
 * policy frozen on its PO (D-022, D-164) — an advance on acceptance, a balance after POD and the
 * claim window, a retention after its release period, another vendor's bill by its terms.
 */
export function PayablesList({ initial }: { initial: InitialPage<PayableItem> | null }) {
  const t = useTranslations("finance.payables.open");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<PayableItem>[] = [
    {
      id: "vendor",
      header: t("columns.vendor"),
      cell: (row) => (
        <div>
          <VendorLink id={row.vendorId} name={row.vendorName} />
          <p className="text-muted text-xs">{t(`sources.${row.source}`)}</p>
        </div>
      ),
    },
    {
      id: "po",
      header: t("columns.po"),
      cell: (row) => (
        <span className="font-mono text-sm whitespace-nowrap">
          {row.poNumber ?? "–"}
          {row.orderCode ? <span className="text-muted block text-xs">{row.orderCode}</span> : null}
        </span>
      ),
    },
    {
      id: "eligibleAt",
      header: t("columns.eligibleAt"),
      sortable: true,
      cell: (row) =>
        row.eligibleAt ? format.date(row.eligibleAt) : <span className="text-muted">{t("waiting")}</span>,
    },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.openNetAmount) },
    { id: "vat", header: t("columns.vat"), numeric: true, cell: (row) => format.thb(row.openVatAmount) },
    {
      id: "retention",
      header: t("columns.retention"),
      numeric: true,
      hideable: true,
      cell: (row) => (row.retentionPct === "0.0000" ? "–" : format.percent(row.retentionPct)),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PAYABLE_STATUS} value={row.status} />,
    },
  ];
  return (
    <ResourceList
      resource={payablesList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: PAYABLE_STATUSES.map((value) => ({ value, label: tStatus(PAYABLE_STATUS[value].labelKey) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}

/** Factory POs (§6): one per released production job, at the price frozen at release. */
export function PurchaseOrdersList({ initial }: { initial: InitialPage<PurchaseOrder> | null }) {
  const t = useTranslations("finance.payables.purchaseOrders");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      id: "poNumber",
      header: t("columns.number"),
      cell: (row) => (
        <div>
          <Link
            href={`/finance/payables/purchase-orders/${row.id}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.poNumber}
          </Link>
          <p className="text-muted font-mono text-xs">{row.jobNo}</p>
        </div>
      ),
    },
    { id: "factory", header: t("columns.factory"), cell: (row) => <VendorLink id={row.factoryId} /> },
    {
      id: "order",
      header: t("columns.order"),
      cell: (row) => <span className="font-mono text-sm whitespace-nowrap">{row.orderCode}</span>,
    },
    { id: "issuedAt", header: t("columns.issuedAt"), sortable: true, cell: (row) => format.date(row.issuedAt) },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PURCHASE_ORDER_STATUS} value={row.status} />,
    },
  ];
  return (
    <ResourceList
      resource={purchaseOrdersList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: PO_STATUSES.map((value) => ({ value, label: tStatus(PURCHASE_ORDER_STATUS[value].labelKey) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}

function ApLines({ lines }: { lines: Schemas["ApLineDto"][] }) {
  const t = useTranslations("finance.payables.lines");
  const format = useFormat();
  return (
    <DataTable
      caption={t("caption")}
      density="compact"
      rows={lines}
      getRowId={(row) => String(row.lineNo)}
      columns={[
        { id: "description", header: t("description"), cell: (row) => row.description },
        { id: "type", header: t("type"), cell: (row) => t(`types.${row.lineType}`) },
        { id: "wht", header: t("wht"), cell: (row) => t(`whtCategories.${row.whtCategory}`) },
        { id: "quantity", header: t("quantity"), numeric: true, cell: (row) => format.number(row.quantity) },
        { id: "net", header: t("net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
        { id: "vat", header: t("vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
        { id: "gross", header: t("gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
      ]}
    />
  );
}

export function PurchaseOrderDetail({ poId }: { poId: string }) {
  const t = useTranslations("finance.payables.purchaseOrders");
  const format = useFormat();
  const po = useQuery({
    queryKey: queryKeys.detail("admin", "purchase-order", poId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/purchase-orders/{poId}", { params: { path: { poId } } })).data!,
  });
  const receipts = useQuery({
    queryKey: queryKeys.list("admin", "goods-receipt", { q: po.data?.poNumber }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/goods-receipts", {
          params: { query: { q: po.data!.poNumber, perPage: 50 } },
        })
      ).data!,
    enabled: Boolean(po.data),
  });
  if (po.isError) return <QueryError error={po.error} onRetry={() => void po.refetch()} />;
  const data = po.data;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/finance/payables/purchase-orders" }, { label: data.poNumber }]}
          />
        }
        title={t("detailTitle", { number: data.poNumber })}
        meta={<StatusChip map={PURCHASE_ORDER_STATUS} value={data.status} size="md" />}
        description={t("detailDescription", { job: data.jobNo, order: data.orderCode })}
      />
      <Section title={t("summary")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("columns.factory"), description: <VendorLink id={data.factoryId} /> },
            { term: t("columns.issuedAt"), description: <When at={data.issuedAt} absoluteOnly /> },
            { term: t("kind"), description: t(`kinds.${data.poKind}`) },
            { term: t("columns.net"), description: format.thb(data.netAmount) },
            { term: t("vat"), description: format.thb(data.vatAmount) },
            { term: t("columns.gross"), description: format.thb(data.grossAmount) },
          ]}
        />
      </Section>
      <Section title={t("lines")}>
        <ApLines lines={data.lines} />
      </Section>
      <Section title={t("receipts")}>
        <DataTable
          caption={t("receipts")}
          density="compact"
          rows={receipts.data?.data ?? []}
          loading={receipts.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="package" title={t("noReceipts")} />}
          columns={[
            { id: "gr", header: t("grNumber"), cell: (row) => <span className="font-mono">{row.grNumber}</span> },
            { id: "on", header: t("receivedOn"), cell: (row) => format.date(row.receivedOn) },
            {
              id: "qty",
              header: t("payableQuantity"),
              numeric: true,
              cell: (row) => format.number(row.payableQuantity),
            },
            { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
          ]}
        />
      </Section>
    </div>
  );
}

/** Goods receipts from POD (P15): the factory is paid for min(delivered, ordered) — D-165. */
export function GoodsReceiptsList({ initial }: { initial: InitialPage<GoodsReceipt> | null }) {
  const t = useTranslations("finance.payables.goodsReceipts");
  const format = useFormat();
  const columns: DataTableColumn<GoodsReceipt>[] = [
    {
      id: "grNumber",
      header: t("columns.number"),
      cell: (row) => (
        <div>
          <span className="font-mono text-sm whitespace-nowrap">{row.grNumber}</span>
          <p className="text-muted font-mono text-xs">{row.poNumber}</p>
        </div>
      ),
    },
    { id: "receivedOn", header: t("columns.receivedOn"), sortable: true, cell: (row) => format.date(row.receivedOn) },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) =>
        row.receivedQuantity === row.payableQuantity ? (
          format.number(row.payableQuantity)
        ) : (
          <span>
            {format.number(row.payableQuantity)}
            <span className="text-muted block text-xs">
              {t("received", { quantity: format.number(row.receivedQuantity) })}
            </span>
          </span>
        ),
    },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "vat", header: t("columns.vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
    { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
  ];
  return (
    <ResourceList
      resource={goodsReceiptsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      empty={{ title: t("empty") }}
    />
  );
}

/** The billing statements getpack generates from PO + POD for the factory to confirm (D-090). */
export function BillingStatementsList({ initial }: { initial: InitialPage<BillingStatement> | null }) {
  const t = useTranslations("finance.payables.statements");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<BillingStatement>[] = [
    {
      id: "bsNumber",
      header: t("columns.number"),
      cell: (row) => (
        <Link
          href={`/finance/payables/statements/${row.id}`}
          className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
        >
          {row.bsNumber}
        </Link>
      ),
    },
    { id: "factory", header: t("columns.factory"), cell: (row) => <VendorLink id={row.factoryId} /> },
    {
      id: "period",
      header: t("columns.period"),
      cell: (row) => (
        <span className="whitespace-nowrap">
          {t("period", { from: format.date(row.periodFrom), to: format.date(row.periodTo) })}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={BILLING_STATEMENT_STATUS} value={row.status} />,
    },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    {
      id: "confirmedAt",
      header: t("columns.confirmedAt"),
      hideable: true,
      cell: (row) => <When at={row.confirmedAt} />,
    },
  ];
  return (
    <ResourceList
      resource={billingStatementsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: (["generated", "sent", "confirmed", "disputed", "superseded"] as const).map((value) => ({
            value,
            label: tStatus(BILLING_STATEMENT_STATUS[value].labelKey),
          })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}

/** The verbs of `billing_statement.*` Finance performs here (getpack-api `ADMIN_STATEMENT_ACTIONS`). */
const STATEMENT_VERBS: ReadonlySet<string> = new Set(["capture_tax_invoice", "validate_tax_invoice"]);

/**
 * One billing statement: its lines (production, shipping, deductions, the advance already paid)
 * and the API's totals, whether and by whom the factory confirmed it, and the factory's own tax
 * invoices against it. Finance keys in a tax invoice the factory sent by other means; it is then
 * validated like any other. What may be done next is the statement's own `nextActions`.
 */
export function BillingStatementDetail({ statementId }: { statementId: string }) {
  const t = useTranslations("finance.payables.statements");
  const format = useFormat();
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);
  const statement = useQuery({
    queryKey: queryKeys.detail("admin", "billing-statement", statementId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/billing-statements/{statementId}", {
          params: { path: { statementId } },
        })
      ).data!,
  });
  if (statement.isError) return <QueryError error={statement.error} onRetry={() => void statement.refetch()} />;
  const data = statement.data;
  if (!data) return null;
  const recorded = data.taxInvoices.find((invoice) => invoice.status === "recorded");
  const disputed = new Set(data.disputedLineNos);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/finance/payables/statements" }, { label: data.bsNumber }]}
          />
        }
        title={t("detailTitle", { number: data.bsNumber })}
        meta={<StatusChip map={BILLING_STATEMENT_STATUS} value={data.status} size="md" />}
        description={t("period", { from: format.date(data.periodFrom), to: format.date(data.periodTo) })}
        actions={
          <NextActionBar
            actions={data.nextActions}
            supported={STATEMENT_VERBS}
            labelOf={(verb) =>
              verb === "capture_tax_invoice"
                ? t("capture")
                : verb === "validate_tax_invoice"
                  ? t("validate")
                  : undefined
            }
            onAction={(verb) => {
              if (verb === "capture_tax_invoice") setCapturing(true);
              else if (recorded) router.push(`/finance/payables/invoices/${recorded.id}`);
            }}
          />
        }
      />
      {data.status === "disputed" && data.disputeNote ? (
        <Callout tone="danger" title={t("disputed")}>
          {data.disputeNote}
        </Callout>
      ) : null}
      {data.status === "confirmed" && data.taxInvoiceStatus !== "validated" ? (
        <Callout tone="warning" title={t("missingInvoice")}>
          {t("missingInvoiceBody")}
        </Callout>
      ) : null}
      <Section title={t("summary")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("columns.factory"), description: <VendorLink id={data.factoryId} /> },
            {
              term: t("columns.confirmedAt"),
              description: data.confirmedAt ? (
                <>
                  <When at={data.confirmedAt} absoluteOnly />
                  {data.confirmedBy ? <span className="text-muted"> · {data.confirmedBy.displayName}</span> : null}
                </>
              ) : (
                "—"
              ),
            },
            { term: t("generatedAt"), description: <When at={data.generatedAt} absoluteOnly /> },
            { term: t("totals.production"), description: format.thb(data.totals.production) },
            { term: t("totals.shipping"), description: format.thb(data.totals.shipping) },
            { term: t("totals.other"), description: format.thb(data.totals.other) },
            { term: t("totals.deductions"), description: format.thb(data.totals.deductions) },
            { term: t("totals.advanceOffset"), description: format.thb(data.totals.advanceOffset) },
            { term: t("columns.net"), description: format.thb(data.totals.net) },
            { term: t("vat"), description: format.thb(data.totals.vat) },
            { term: t("columns.gross"), description: format.thb(data.totals.gross) },
            { term: t("totals.alreadyPaid"), description: format.thb(data.totals.alreadyPaid) },
            { term: t("totals.remaining"), description: format.thb(data.totals.remaining) },
          ]}
        />
      </Section>
      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          density="compact"
          rows={data.lines}
          getRowId={(row) => String(row.lineNo)}
          rowTone={(row) => (disputed.has(row.lineNo) ? "danger" : undefined)}
          empty={<EmptyState icon="document" title={t("noLines")} />}
          columns={[
            { id: "kind", header: t("lineKind"), cell: (row) => t(`lineKinds.${row.kind}`) },
            {
              id: "description",
              header: t("lineDescription"),
              cell: (row) => (
                <>
                  {row.description}
                  {row.reference ? <span className="text-muted block font-mono text-xs">{row.reference}</span> : null}
                  {disputed.has(row.lineNo) ? (
                    <span className="text-danger block text-xs">{t("lineDisputed")}</span>
                  ) : null}
                </>
              ),
            },
            {
              id: "quantity",
              header: t("quantity"),
              numeric: true,
              cell: (row) => (row.quantity === null ? "—" : format.number(row.quantity)),
            },
            { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
            { id: "vat", header: t("vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
            { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
          ]}
        />
      </Section>
      <Section title={t("taxInvoices")}>
        <InvoiceRows rows={data.taxInvoices} />
      </Section>
      {capturing ? <CaptureInvoice statement={data} onClose={() => setCapturing(false)} /> : null}
    </div>
  );
}

function InvoiceRows({ rows, loading }: { rows: VendorInvoice[]; loading?: boolean }) {
  const t = useTranslations("finance.payables.invoices");
  const format = useFormat();
  return (
    <DataTable
      caption={t("title")}
      density="compact"
      rows={rows}
      loading={loading}
      getRowId={(row) => row.id}
      empty={<EmptyState icon="document" title={t("none")} />}
      columns={[
        {
          id: "number",
          header: t("columns.number"),
          cell: (row) => (
            <Link
              href={`/finance/payables/invoices/${row.id}`}
              className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
            >
              {row.vendorInvoiceNo}
            </Link>
          ),
        },
        { id: "date", header: t("columns.date"), cell: (row) => format.date(row.invoiceDate) },
        {
          id: "status",
          header: t("columns.status"),
          cell: (row) => <StatusChip map={VENDOR_BILL_STATUS} value={row.status} />,
        },
        {
          id: "vat",
          header: t("columns.inputVat"),
          cell: (row) => <StatusChip map={INPUT_VAT_STATUS} value={row.inputVatStatus} />,
        },
        { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
      ]}
    />
  );
}

/** Keys in the factory's own tax invoice (D-090): its number, date, tax id, branch and amounts. */
function CaptureInvoice({ statement, onClose }: { statement: BillingStatement; onClose: () => void }) {
  const t = useTranslations("finance.payables.capture");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const vendors = useVendors();
  const factory = vendors.data?.find((vendor) => vendor.id === statement.factoryId);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    vendorInvoiceNo: "",
    invoiceDate: "",
    sellerTaxId: factory?.taxId ?? "",
    sellerBranchCode: factory?.branchCode ?? "00000",
    netAmount: statement.netAmount,
    vatAmount: statement.vatAmount,
    source: "pdf_upload" as Schemas["TaxInvoiceCaptureSource"],
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <FormDialog
      title={t("title", { number: statement.bsNumber })}
      description={t("description")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        const net = moneyText(form.netAmount);
        const vat = moneyText(form.vatAmount);
        if (!form.vendorInvoiceNo.trim() || !form.invoiceDate) throw new FormError(t("needNumber"));
        if (!net || !vat) throw new FormError(t("badAmount"));
        if (form.source === "pdf_upload" && !file) throw new FormError(t("needFile"));
        try {
          const uploaded = file ? await uploadFile("admin", file, "document") : null;
          await adminBrowserApis().contract.POST("/v1/admin/billing-statements/{statementId}/tax-invoices", {
            params: { path: { statementId: statement.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              vendorInvoiceNo: form.vendorInvoiceNo.trim(),
              invoiceDate: form.invoiceDate,
              sellerTaxId: form.sellerTaxId.trim(),
              sellerBranchCode: form.sellerBranchCode.trim(),
              netAmount: net,
              vatAmount: vat,
              source: form.source,
              ...(uploaded ? { fileId: uploaded.id } : {}),
            },
          });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "vendor-invoice") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
        toast.success(t("saved"));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("number")} required requiredLabel={tCommon("state.required")} error={errors.vendorInvoiceNo}>
          <Input value={form.vendorInvoiceNo} onChange={set("vendorInvoiceNo")} autoComplete="off" />
        </Field>
        <Field label={t("date")} required requiredLabel={tCommon("state.required")} error={errors.invoiceDate}>
          <Input type="date" value={form.invoiceDate} onChange={set("invoiceDate")} />
        </Field>
        <Field label={t("taxId")} required requiredLabel={tCommon("state.required")} error={errors.sellerTaxId}>
          <Input inputMode="numeric" value={form.sellerTaxId} onChange={set("sellerTaxId")} />
        </Field>
        <Field label={t("branch")} required requiredLabel={tCommon("state.required")} error={errors.sellerBranchCode}>
          <Input inputMode="numeric" value={form.sellerBranchCode} onChange={set("sellerBranchCode")} />
        </Field>
        <Field label={t("net")} hint={t("fromStatement")} error={errors.netAmount}>
          <Input inputMode="decimal" value={form.netAmount} onChange={set("netAmount")} />
        </Field>
        <Field label={t("vat")} hint={t("fromStatement")} error={errors.vatAmount}>
          <Input inputMode="decimal" value={form.vatAmount} onChange={set("vatAmount")} />
        </Field>
        <Field label={t("source")} className="sm:col-span-2">
          <SearchableSelect<Schemas["TaxInvoiceCaptureSource"]>
            value={form.source}
            onValueChange={(source) => setForm({ ...form, source })}
            options={[
              { value: "pdf_upload", label: t("sources.pdf_upload") },
              { value: "e_tax", label: t("sources.e_tax") },
            ]}
          />
        </Field>
        {form.source === "pdf_upload" ? (
          <Field label={t("file")} className="sm:col-span-2" error={errors.fileId}>
            <FileDropzone
              accept="application/pdf"
              maxBytes={20 * 1024 * 1024}
              onFiles={([picked]) => setFile(picked ?? null)}
              labels={{
                prompt: file ? t("chosen", { name: file.name }) : t("drop"),
                browse: t("browse"),
                tooLarge: (name) => t("tooLarge", { name }),
                wrongType: (name) => t("wrongType", { name }),
              }}
            />
          </Field>
        ) : null}
      </div>
    </FormDialog>
  );
}

/** Factory tax invoices captured against statements, and other vendors' bills (§2). */
export function VendorInvoicesList({ initial }: { initial: InitialPage<VendorInvoice> | null }) {
  const t = useTranslations("finance.payables.invoices");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<VendorInvoice>[] = [
    {
      id: "vendorInvoiceNo",
      header: t("columns.number"),
      cell: (row) => (
        <div>
          <Link
            href={`/finance/payables/invoices/${row.id}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.vendorInvoiceNo}
          </Link>
          <p className="text-muted text-xs">{row.bsNumber ?? t(row.isTaxInvoice ? "taxInvoice" : "notTaxInvoice")}</p>
        </div>
      ),
    },
    {
      id: "vendor",
      header: t("columns.vendor"),
      cell: (row) => <VendorLink id={row.vendorId} name={row.vendorName} />,
    },
    { id: "invoiceDate", header: t("columns.date"), sortable: true, cell: (row) => format.date(row.invoiceDate) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={VENDOR_BILL_STATUS} value={row.status} />,
    },
    {
      id: "inputVat",
      header: t("columns.inputVat"),
      cell: (row) => <StatusChip map={INPUT_VAT_STATUS} value={row.inputVatStatus} />,
    },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "gross", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
  ];
  return (
    <ResourceList
      resource={vendorInvoicesList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: VENDOR_BILL_STATUSES.map((value) => ({ value, label: tStatus(VENDOR_BILL_STATUS[value].labelKey) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}

/**
 * One tax invoice or bill. For a factory's tax invoice, the fields §2 requires are checked against
 * the vendor record and the statement — seller tax id, branch, amounts — before Finance validates
 * it; a valid one makes the input VAT claimable (P17V).
 */
export function VendorInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("finance.payables.invoices");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("payables.manage");
  const vendors = useVendors();
  const [action, setAction] = useState<"validate" | "reject" | null>(null);
  const key = queryKeys.detail("admin", "vendor-invoice", invoiceId);
  const invoice = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/vendor-invoices/{invoiceId}", {
          params: { path: { invoiceId } },
        })
      ).data!,
  });
  const statement = useQuery({
    queryKey: queryKeys.list("admin", "billing-statement", { q: invoice.data?.bsNumber }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/billing-statements", {
          params: { query: { q: invoice.data!.bsNumber!, perPage: 5 } },
        })
      ).data!,
    enabled: Boolean(invoice.data?.bsNumber),
    select: (page) => page.data[0] ?? null,
  });
  if (invoice.isError) return <QueryError error={invoice.error} onRetry={() => void invoice.refetch()} />;
  const data = invoice.data;
  if (!data) return null;
  const vendor = vendors.data?.find((item) => item.id === data.vendorId);
  const checks = [
    {
      key: "taxId",
      ok: vendor ? vendor.taxId === data.sellerTaxId : null,
      shown: data.sellerTaxId,
      expected: vendor?.taxId,
    },
    {
      key: "branch",
      ok: vendor ? vendor.branchCode === data.sellerBranchCode : null,
      shown: data.sellerBranchCode,
      expected: vendor?.branchCode,
    },
    ...(statement.data
      ? [
          {
            key: "net",
            ok: statement.data.netAmount === data.netAmount,
            shown: format.thb(data.netAmount),
            expected: format.thb(statement.data.netAmount),
          },
          {
            key: "vat",
            ok: statement.data.vatAmount === data.vatAmount,
            shown: format.thb(data.vatAmount),
            expected: format.thb(statement.data.vatAmount),
          },
        ]
      : []),
  ];

  async function decide(valid: boolean, idempotencyKey: string, reason: string) {
    try {
      const { data: updated } = await adminBrowserApis().contract.POST(
        "/v1/admin/vendor-invoices/{invoiceId}/actions/validate",
        {
          params: { path: { invoiceId }, header: { "Idempotency-Key": idempotencyKey } },
          body: valid ? { valid: true } : { valid: false, reason },
        },
      );
      queryClient.setQueryData(key, updated);
      invalidateMoney(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "vendor-invoice") });
      toast.success(valid ? t("validated") : t("rejectedToast"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/finance/payables/invoices" }, { label: data.vendorInvoiceNo }]}
          />
        }
        title={t("detailTitle", { number: data.vendorInvoiceNo })}
        meta={
          <>
            <StatusChip map={VENDOR_BILL_STATUS} value={data.status} size="md" />
            <StatusChip map={INPUT_VAT_STATUS} value={data.inputVatStatus} size="md" />
          </>
        }
        description={data.vendorName}
        actions={
          canManage && data.status === "recorded" && data.bsNumber ? (
            <>
              <Button variant="ghost" onClick={() => setAction("reject")}>
                {t("reject")}
              </Button>
              <Button onClick={() => setAction("validate")}>{t("validate")}</Button>
            </>
          ) : null
        }
      />
      {data.status === "rejected" && data.rejectionReason ? (
        <Callout tone="danger" title={t("rejectedTitle")}>
          {data.rejectionReason}
        </Callout>
      ) : null}
      {data.bsNumber ? (
        <Section title={t("checks")} description={t("checksNote")}>
          <ul className="flex flex-col gap-2">
            {checks.map((check) => (
              <li key={check.key} className="flex flex-wrap items-center gap-2 text-sm">
                <Icon
                  name={check.ok === null ? "help" : check.ok ? "success" : "danger"}
                  className={check.ok === false ? "text-danger" : check.ok ? "text-success" : "text-muted"}
                />
                <span className="font-medium">{t(`checkNames.${check.key}`)}</span>
                <span className="font-mono">{check.shown}</span>
                {check.ok === false ? (
                  <span className="text-danger">{t("expected", { value: check.expected ?? "—" })}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title={t("summary")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("columns.vendor"), description: <VendorLink id={data.vendorId} name={data.vendorName} /> },
            { term: t("columns.date"), description: format.date(data.invoiceDate) },
            { term: t("statement"), description: data.bsNumber ?? "—" },
            { term: t("sellerTaxId"), description: <span className="font-mono">{data.sellerTaxId}</span> },
            { term: t("sellerBranch"), description: <span className="font-mono">{data.sellerBranchCode}</span> },
            { term: t("source"), description: t(`sources.${data.source}`) },
            { term: t("columns.net"), description: format.thb(data.netAmount) },
            { term: t("vat"), description: format.thb(data.vatAmount) },
            { term: t("columns.gross"), description: format.thb(data.grossAmount) },
          ]}
        />
      </Section>
      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          density="compact"
          rows={data.lines}
          getRowId={(row) => `${row.description}:${row.netAmount}`}
          columns={[
            { id: "description", header: t("lineDescription"), cell: (row) => row.description },
            {
              id: "account",
              header: t("account"),
              cell: (row) => <span className="font-mono">{row.accountCode ?? "–"}</span>,
            },
            { id: "wht", header: t("wht"), cell: (row) => t(`whtCategories.${row.whtCategory}`) },
            { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
            { id: "vat", header: t("vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
          ]}
        />
      </Section>
      {data.bsNumber ? null : (
        <Section title={t("journals")}>
          <SourceJournals sourceType="vendor_invoice" sourceId={data.id} />
        </Section>
      )}
      <ConfirmAction
        open={action !== null}
        onOpenChange={(open) => (open ? undefined : setAction(null))}
        title={action === "reject" ? t("rejectTitle") : t("validateTitle")}
        description={
          action === "reject"
            ? t("rejectBody", { number: data.vendorInvoiceNo })
            : t("validateBody", { number: data.vendorInvoiceNo, vat: format.thb(data.vatAmount) })
        }
        confirmLabel={action === "reject" ? t("reject") : t("validate")}
        tone={action === "reject" ? "destructive" : "primary"}
        reason={action === "reject" ? { label: t("rejectReason"), required: true, minLength: 3 } : undefined}
        onConfirm={({ idempotencyKey, reason }) => decide(action === "validate", idempotencyKey, reason)}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------------- vendors */

const OTHER_KINDS = [
  "carrier",
  "freelancer",
  "service",
  "other",
] as const satisfies readonly Schemas["OtherVendorKind"][];
const WHT_CATEGORIES = [
  "hire_of_work",
  "transport",
  "service",
  "none",
] as const satisfies readonly Schemas["WhtCategory"][];

/** The vendor master (§6): factories from onboarding and the others Finance creates. */
export function VendorsList() {
  const t = useTranslations("finance.payables.vendors");
  const canManage = useCan("payables.vendors.manage");
  const vendors = useVendors();
  const [creating, setCreating] = useState(false);
  if (vendors.isError) return <QueryError error={vendors.error} onRetry={() => void vendors.refetch()} />;
  const columns: DataTableColumn<Vendor>[] = [
    {
      id: "legalName",
      header: t("columns.name"),
      cell: (row) => (
        <div>
          <Link href={`/finance/payables/vendors/${row.id}`} className="text-primary hover:underline">
            {row.legalName}
          </Link>
          <p className="text-muted font-mono text-xs">
            {row.taxId} · {row.branchCode}
          </p>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { id: "vat", header: t("columns.vat"), cell: (row) => (row.isVatRegistered ? t("vatYes") : t("vatNo")) },
    {
      id: "wht",
      header: t("columns.wht"),
      cell: (row) =>
        `${t(`whtCategories.${row.defaultWhtCategory}`)} · ${row.juristicType === "individual" ? "ภ.ง.ด.3" : "ภ.ง.ด.53"}`,
    },
    {
      id: "terms",
      header: t("columns.terms"),
      numeric: true,
      cell: (row) => t("days", { days: row.paymentTermsDays }),
    },
  ];
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        canManage ? (
          <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={vendors.data ?? []}
        loading={vendors.isPending}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="building" title={t("empty")} />}
      />
      {creating ? <CreateVendor onClose={() => setCreating(false)} /> : null}
    </Section>
  );
}

function CreateVendor({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.payables.vendors.create");
  const tVendors = useTranslations("finance.payables.vendors");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    legalName: "",
    taxId: "",
    branchCode: "00000",
    kind: "carrier" as Schemas["OtherVendorKind"],
    juristicType: "company" as Schemas["JuristicType"],
    isVatRegistered: true,
    paymentTermsDays: "30",
    defaultWhtCategory: "transport" as Schemas["WhtCategory"],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await adminBrowserApis().contract.POST("/v1/admin/vendors", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: { ...form, legalName: form.legalName.trim(), paymentTermsDays: Number(form.paymentTermsDays) || 0 },
          });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "vendor") });
        toast.success(t("saved"));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("name")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.legalName}
          className="sm:col-span-2"
        >
          <Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
        </Field>
        <Field label={t("taxId")} required requiredLabel={tCommon("state.required")} error={errors.taxId}>
          <Input
            inputMode="numeric"
            value={form.taxId}
            onChange={(event) => setForm({ ...form, taxId: event.target.value })}
          />
        </Field>
        <Field label={t("branch")}>
          <Input
            inputMode="numeric"
            value={form.branchCode}
            onChange={(event) => setForm({ ...form, branchCode: event.target.value })}
          />
        </Field>
        <Field label={t("kind")}>
          <SearchableSelect<Schemas["OtherVendorKind"]>
            value={form.kind}
            onValueChange={(kind) => setForm({ ...form, kind })}
            options={OTHER_KINDS.map((value) => ({ value, label: tVendors(`kinds.${value}`) }))}
          />
        </Field>
        <Field label={t("juristic")} hint={t("juristicHint")}>
          <SearchableSelect<Schemas["JuristicType"]>
            value={form.juristicType}
            onValueChange={(juristicType) => setForm({ ...form, juristicType })}
            options={(["company", "partnership", "individual"] as const).map((value) => ({
              value,
              label: t(`juristicTypes.${value}`),
            }))}
          />
        </Field>
        <Field label={t("wht")}>
          <SearchableSelect<Schemas["WhtCategory"]>
            value={form.defaultWhtCategory}
            onValueChange={(defaultWhtCategory) => setForm({ ...form, defaultWhtCategory })}
            options={WHT_CATEGORIES.map((value) => ({ value, label: tVendors(`whtCategories.${value}`) }))}
          />
        </Field>
        <Field label={t("terms")}>
          <Input
            inputMode="numeric"
            value={form.paymentTermsDays}
            onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            checked={form.isVatRegistered}
            onCheckedChange={(value) => setForm({ ...form, isVatRegistered: value === true })}
            label={t("vatRegistered")}
          />
        </div>
      </div>
    </FormDialog>
  );
}

type BankAccount = Schemas["BankAccountDto"];

/**
 * One vendor: its record, its bank accounts with every change (dual approval — Finance, then
 * Finance Manager — and the call-back log, §8), its bills, and recording a new one.
 */
export function VendorDetail({ vendorId }: { vendorId: string }) {
  const t = useTranslations("finance.payables.vendors");
  const format = useFormat();
  const vendors = useVendors();
  const canPropose = useCan("payables.vendors.manage");
  const canVerify = useCan("vendor_bank_accounts.verify");
  const canRecord = useCan("payables.bills.record");
  const [proposing, setProposing] = useState(false);
  const [verifying, setVerifying] = useState<BankAccount | null>(null);
  const [billing, setBilling] = useState(false);
  const vendor = vendors.data?.find((item) => item.id === vendorId);
  const factory = vendor?.kind === "factory";
  const banks = useQuery({
    queryKey: queryKeys.related("admin", "vendor", vendorId, "bank-accounts"),
    queryFn: async () =>
      factory
        ? (
            await adminBrowserApis().contract.GET("/v1/admin/factories/{factoryId}/bank-accounts", {
              params: { path: { factoryId: vendorId } },
            })
          ).data!
        : (
            await adminBrowserApis().contract.GET("/v1/admin/vendors/{vendorId}/bank-accounts", {
              params: { path: { vendorId } },
            })
          ).data!,
    enabled: Boolean(vendor),
  });
  const bills = useQuery({
    queryKey: queryKeys.list("admin", "vendor-invoice", { vendorId }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/vendor-invoices", {
          params: { query: { vendorId, perPage: 50 } },
        })
      ).data!,
  });
  if (vendors.isError) return <QueryError error={vendors.error} onRetry={() => void vendors.refetch()} />;
  if (!vendor) return null;

  const bankColumns: DataTableColumn<BankAccount>[] = [
    {
      id: "account",
      header: t("banks.account"),
      cell: (row) => (
        <div>
          <AccountNo bank={row.bankCode} last4={row.accountNoLast4} />
          <p className="text-muted text-xs">{row.accountName}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("banks.status"),
      cell: (row) => <StatusChip map={BANK_ACCOUNT_STATUS} value={row.status} />,
    },
    {
      id: "verification",
      header: t("banks.verification"),
      cell: (row) =>
        row.verification ? (
          <span className="text-sm">
            {t(`outcomes.${row.verification.outcome}`)}
            <span className="text-muted block text-xs">
              {row.verification.calledNumberMasked} · {format.dateTime(row.verification.calledAt)}
            </span>
          </span>
        ) : (
          <span className="text-muted">{t("banks.notCalled")}</span>
        ),
    },
    {
      id: "flags",
      header: t("banks.flags"),
      cell: (row) =>
        row.duplicateOfOtherVendor ? (
          <Badge tone="danger" icon="warning">
            {t("banks.duplicate")}
          </Badge>
        ) : null,
    },
    {
      id: "approval",
      header: t("banks.approval"),
      cell: (row) =>
        row.approvalRequestId ? (
          <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary hover:underline">
            {t("banks.openApproval")}
          </Link>
        ) : (
          "–"
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("banks.actions")}</span>,
      cell: (row) =>
        canVerify && row.status === "pending_approval" && !row.verification ? (
          <Button size="sm" variant="secondary" onClick={() => setVerifying(row)}>
            {t("banks.recordCall")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/finance/payables/vendors" }, { label: vendor.legalName }]}
          />
        }
        title={vendor.legalName}
        meta={<Badge tone="neutral">{t(`kinds.${vendor.kind}`)}</Badge>}
        description={`${vendor.taxId} · ${t("branch", { code: vendor.branchCode })}`}
        actions={
          canRecord && !factory ? (
            <Button iconStart="plus" onClick={() => setBilling(true)}>
              {t("recordBill")}
            </Button>
          ) : null
        }
      />
      <Section title={t("record")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("columns.vat"), description: vendor.isVatRegistered ? t("vatYes") : t("vatNo") },
            {
              term: t("columns.wht"),
              description: `${t(`whtCategories.${vendor.defaultWhtCategory}`)} · ${vendor.juristicType === "individual" ? "ภ.ง.ด.3" : "ภ.ง.ด.53"}`,
            },
            { term: t("columns.terms"), description: t("days", { days: vendor.paymentTermsDays }) },
          ]}
        />
      </Section>
      <Section
        title={t("banks.title")}
        description={factory ? t("banks.factoryNote") : t("banks.note")}
        actions={
          canPropose && !factory ? (
            <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setProposing(true)}>
              {t("banks.propose")}
            </Button>
          ) : null
        }
      >
        {banks.isError ? (
          <QueryError error={banks.error} onRetry={() => void banks.refetch()} />
        ) : (
          <DataTable
            caption={t("banks.title")}
            columns={bankColumns}
            rows={banks.data ?? []}
            loading={banks.isPending}
            getRowId={(row) => row.id}
            density="compact"
            empty={<EmptyState icon="building" title={t("banks.none")} />}
          />
        )}
      </Section>
      <Section title={t("bills")}>
        <InvoiceRows rows={bills.data?.data ?? []} loading={bills.isPending} />
      </Section>
      {proposing ? <ProposeBankAccount vendor={vendor} onClose={() => setProposing(false)} /> : null}
      {verifying ? <RecordCall account={verifying} vendorId={vendor.id} onClose={() => setVerifying(null)} /> : null}
      {billing ? <RecordBill vendor={vendor} onClose={() => setBilling(false)} /> : null}
    </div>
  );
}

function ProposeBankAccount({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const t = useTranslations("finance.payables.vendors.propose");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ bankCode: "014", accountName: vendor.legalName, accountNo: "", branchName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { vendor: vendor.legalName })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!/^[\d\s-]{10,19}$/.test(form.accountNo.trim()) || !form.accountName.trim())
                setErrors({ accountNo: t("badNumber") });
              else setConfirming(true);
            }}
          >
            {t("review")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("bank")} required requiredLabel={tCommon("state.required")}>
          <SearchableSelect
            value={form.bankCode}
            onValueChange={(bankCode) => setForm({ ...form, bankCode })}
            options={["002", "004", "006", "011", "014", "025", "069"].map((code) => ({
              value: code,
              label: t(`banks.${code}`),
            }))}
          />
        </Field>
        <Field
          label={t("number")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.accountNo}
          hint={t("numberHint")}
        >
          <Input
            inputMode="numeric"
            value={form.accountNo}
            onChange={(event) => setForm({ ...form, accountNo: event.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label={t("name")} required requiredLabel={tCommon("state.required")} className="sm:col-span-2">
          <Input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} />
        </Field>
        <Field label={t("branchName")} className="sm:col-span-2">
          <Input value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
        </Field>
      </div>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", { vendor: vendor.legalName, last4: form.accountNo.replace(/\D/g, "").slice(-4) })}
        confirmLabel={t("send")}
        confirmationPhrase={vendor.taxId}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/vendors/{vendorId}/bank-accounts", {
              params: { path: { vendorId: vendor.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: {
                bankCode: form.bankCode,
                accountName: form.accountName.trim(),
                accountNo: form.accountNo.trim(),
                branchName: form.branchName.trim() || null,
              },
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.related("admin", "vendor", vendor.id, "bank-accounts"),
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
            toast.success(t("sent"));
            onClose();
          } catch (error) {
            setErrors(fieldErrorsOf(error));
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </Dialog>
  );
}

/** The call-back on the number already on record — never one given in the change request (§8). */
function RecordCall({ account, vendorId, onClose }: { account: BankAccount; vendorId: string; onClose: () => void }) {
  const t = useTranslations("finance.payables.vendors.call");
  const tVendors = useTranslations("finance.payables.vendors");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    calledNumber: "",
    calledAt: "",
    outcome: "confirmed" as Schemas["BankVerificationOutcome"],
    note: "",
  });
  return (
    <FormDialog
      title={t("title", { last4: account.accountNoLast4 })}
      description={t("description")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.calledNumber.trim() || !form.calledAt) throw new FormError(t("needCall"));
        await adminBrowserApis().contract.POST("/v1/admin/vendor-bank-accounts/{accountId}/verification-calls", {
          params: { path: { accountId: account.id } },
          body: {
            calledNumber: form.calledNumber.trim(),
            calledAt: `${form.calledAt}:00+07:00`,
            outcome: form.outcome,
            note: form.note.trim() || null,
          },
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.related("admin", "vendor", vendorId, "bank-accounts"),
        });
        toast.success(t("saved"));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Callout tone="warning" title={t("rule")} className="sm:col-span-2" />
        <Field label={t("number")} required requiredLabel={tCommon("state.required")}>
          <Input
            inputMode="tel"
            value={form.calledNumber}
            onChange={(event) => setForm({ ...form, calledNumber: event.target.value })}
          />
        </Field>
        <Field label={t("at")} required requiredLabel={tCommon("state.required")}>
          <Input
            type="datetime-local"
            value={form.calledAt}
            onChange={(event) => setForm({ ...form, calledAt: event.target.value })}
          />
        </Field>
        <Field label={t("outcome")} className="sm:col-span-2">
          <SearchableSelect<Schemas["BankVerificationOutcome"]>
            value={form.outcome}
            onValueChange={(outcome) => setForm({ ...form, outcome })}
            options={(["confirmed", "mismatch", "unreachable"] as const).map((value) => ({
              value,
              label: tVendors(`outcomes.${value}`),
            }))}
          />
        </Field>
        <Field label={t("note")} className="sm:col-span-2">
          <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={2} />
        </Field>
      </div>
    </FormDialog>
  );
}

interface BillLine {
  accountCode: string;
  description: string;
  netAmount: string;
  vatAmount: string;
  whtCategory: Schemas["WhtCategory"];
}

/** Another vendor's bill (P25 / P26): expense or cost lines, input VAT only on a valid tax invoice. */
function RecordBill({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const t = useTranslations("finance.payables.bill");
  const tVendors = useTranslations("finance.payables.vendors");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const accounts = useQuery({
    queryKey: queryKeys.list("admin", "ledger-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/accounts")).data!,
    staleTime: 10 * 60_000,
    select: (rows) =>
      rows.filter(
        (row) => row.isPostable && !row.isControl && ["cost_of_sales", "expense", "asset"].includes(row.accountType),
      ),
  });
  const [header, setHeader] = useState({ vendorInvoiceNo: "", invoiceDate: "", isTaxInvoice: vendor.isVatRegistered });
  const [lines, setLines] = useState<BillLine[]>([
    { accountCode: "", description: "", netAmount: "", vatAmount: "", whtCategory: vendor.defaultWhtCategory },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (index: number, patch: Partial<BillLine>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <FormDialog
      title={t("title", { vendor: vendor.legalName })}
      description={t("description")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        if (!header.vendorInvoiceNo.trim() || !header.invoiceDate) throw new FormError(t("needHeader"));
        const body = lines.map((line) => ({
          accountCode: line.accountCode,
          description: line.description.trim(),
          netAmount: moneyText(line.netAmount) ?? "",
          vatAmount: header.isTaxInvoice ? (moneyText(line.vatAmount || "0") ?? "") : "0.00",
          whtCategory: line.whtCategory,
        }));
        if (body.some((line) => !line.accountCode || !line.description || !line.netAmount || !line.vatAmount))
          throw new FormError(t("needLines"));
        try {
          await adminBrowserApis().contract.POST("/v1/admin/vendors/{vendorId}/bills", {
            params: { path: { vendorId: vendor.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              vendorInvoiceNo: header.vendorInvoiceNo.trim(),
              invoiceDate: header.invoiceDate,
              isTaxInvoice: header.isTaxInvoice,
              lines: body,
            },
          });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        invalidateMoney(queryClient);
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "vendor-invoice") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "payable") });
        toast.success(t("saved"));
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("number")} required requiredLabel={tCommon("state.required")} error={errors.vendorInvoiceNo}>
            <Input
              value={header.vendorInvoiceNo}
              onChange={(event) => setHeader({ ...header, vendorInvoiceNo: event.target.value })}
            />
          </Field>
          <Field label={t("date")} required requiredLabel={tCommon("state.required")}>
            <Input
              type="date"
              value={header.invoiceDate}
              onChange={(event) => setHeader({ ...header, invoiceDate: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              checked={header.isTaxInvoice}
              disabled={!vendor.isVatRegistered}
              onCheckedChange={(value) => setHeader({ ...header, isTaxInvoice: value === true })}
              label={t("taxInvoice")}
              description={t("taxInvoiceHint")}
            />
          </div>
        </div>
        {lines.map((line, index) => (
          <fieldset key={index} className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">{t("line", { no: index + 1 })}</legend>
            <Field
              label={t("account")}
              required
              requiredLabel={tCommon("state.required")}
              error={errors[`lines[${index}].accountCode`]}
            >
              <SearchableSelect
                value={line.accountCode || undefined}
                onValueChange={(accountCode) => update(index, { accountCode })}
                placeholder={t("pickAccount")}
                options={(accounts.data ?? []).map((account) => ({
                  value: account.code,
                  label: `${account.code} ${account.nameTh}`,
                }))}
              />
            </Field>
            <Field label={t("wht")}>
              <SearchableSelect<Schemas["WhtCategory"]>
                value={line.whtCategory}
                onValueChange={(whtCategory) => update(index, { whtCategory })}
                options={WHT_CATEGORIES.map((value) => ({ value, label: tVendors(`whtCategories.${value}`) }))}
              />
            </Field>
            <Field
              label={t("lineDescription")}
              required
              requiredLabel={tCommon("state.required")}
              className="sm:col-span-2"
            >
              <Input
                value={line.description}
                onChange={(event) => update(index, { description: event.target.value })}
              />
            </Field>
            <Field
              label={t("net")}
              required
              requiredLabel={tCommon("state.required")}
              error={errors[`lines[${index}].netAmount`]}
            >
              <Input
                inputMode="decimal"
                value={line.netAmount}
                onChange={(event) => update(index, { netAmount: event.target.value })}
              />
            </Field>
            <Field label={t("vat")} hint={header.isTaxInvoice ? t("vatHint") : t("noVat")}>
              <Input
                inputMode="decimal"
                disabled={!header.isTaxInvoice}
                value={line.vatAmount}
                onChange={(event) => update(index, { vatAmount: event.target.value })}
              />
            </Field>
          </fieldset>
        ))}
        <div>
          <Button
            variant="ghost"
            size="sm"
            iconStart="plus"
            onClick={() =>
              setLines([
                ...lines,
                {
                  accountCode: "",
                  description: "",
                  netAmount: "",
                  vatAmount: "",
                  whtCategory: vendor.defaultWhtCategory,
                },
              ])
            }
          >
            {t("addLine")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
