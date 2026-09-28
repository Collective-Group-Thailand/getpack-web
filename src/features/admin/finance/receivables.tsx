"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DOCUMENT_STATUS, DUNNING_STATUS, RECEIVABLE_STATUS, WHT_CERTIFICATE_STATUS } from "@/domain/status";
import { isZeroMoney, moneyText } from "@/domain/money";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { QueueTabs } from "../console/queues";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import {
  dunningList,
  RECEIVABLE_STATUSES,
  receivablesList,
  whtCertificatesList,
  type DunningEntry,
  type Receivable,
  type WhtCertificate,
} from "./resources";
import { DocumentLink, Figure } from "./shared";
import { invalidateMoney } from "./slips";

type Buckets = Schemas["AgingBucketsDto"];
const BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "over_90"] as const satisfies readonly (keyof Buckets)[];

/** The AR desk's pages side by side. */
export function ReceivablesNav() {
  const t = useTranslations("finance.receivables.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/receivables", label: t("items"), exact: true },
        { href: "/finance/receivables/aging", label: t("aging") },
        { href: "/finance/receivables/wht", label: t("wht") },
        { href: "/finance/receivables/statements", label: t("statements") },
        { href: "/finance/receivables/dunning", label: t("dunning") },
      ]}
    />
  );
}

const partyHref = (row: { customerId: string }) => `/finance/receivables/customers/${row.customerId}`;

function PartyCell({ row }: { row: { customerId: string; customerName: string; companyName: string | null } }) {
  return (
    <div className="min-w-0">
      <Link href={partyHref(row)} className="text-primary hover:underline">
        {row.companyName ?? row.customerName}
      </Link>
      {row.companyName && row.companyName !== row.customerName ? (
        <p className="text-muted truncate text-xs">{row.customerName}</p>
      ) : null}
    </div>
  );
}

/**
 * Open items of customer AR (accounting-design §6): the final tax invoices not yet settled and
 * the B2B invoices on credit terms, by due date. Overdue credit orders are blocked by D-122; a
 * write-off is requested here and approved by a Finance Manager other than the requester.
 */
export function ReceivablesList({ initial }: { initial: InitialPage<Receivable> | null }) {
  const t = useTranslations("finance.receivables.items");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canWriteOff = useCan("receivables.write_off.request");
  const [writingOff, setWritingOff] = useState<Receivable | null>(null);
  const queryClient = useQueryClient();

  const columns: DataTableColumn<Receivable>[] = [
    {
      id: "document",
      header: t("columns.document"),
      cell: (row) => (
        <div>
          <DocumentLink document={row.document} />
          {row.orderCode ? <p className="text-muted font-mono text-xs">{row.orderCode}</p> : null}
        </div>
      ),
    },
    { id: "party", header: t("columns.party"), cell: (row) => <PartyCell row={row} /> },
    { id: "dueDate", header: t("columns.dueDate"), sortable: true, cell: (row) => format.date(row.dueDate) },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    {
      id: "openAmount",
      header: t("columns.open"),
      numeric: true,
      sortable: true,
      cell: (row) => format.thb(row.openAmount),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={RECEIVABLE_STATUS} value={row.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        row.writeOffApprovalId ? (
          <Link href={`/approvals/${row.writeOffApprovalId}`} className="text-primary text-sm hover:underline">
            {t("writeOffPending")}
          </Link>
        ) : canWriteOff && ["open", "partially_paid"].includes(row.status) ? (
          <Button size="sm" variant="ghost" onClick={() => setWritingOff(row)}>
            {t("writeOff")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("viewsLabel")}
        param="overdue"
        tabs={[
          { value: null, label: t("all") },
          { value: "true", label: t("overdue"), countKey: "finance.overdue_b2b_invoices" },
        ]}
      />
      <ResourceList
        resource={receivablesList}
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
            options: RECEIVABLE_STATUSES.map((value) => ({ value, label: tStatus(RECEIVABLE_STATUS[value].labelKey) })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
      {writingOff ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setWritingOff(null))}
          title={t("writeOffTitle")}
          description={t("writeOffBody", {
            number: writingOff.document.docNumber,
            party: writingOff.companyName ?? writingOff.customerName,
            amount: format.thb(writingOff.openAmount),
          })}
          confirmLabel={t("writeOffSend")}
          tone="destructive"
          confirmationPhrase={writingOff.document.docNumber}
          reason={{ label: t("writeOffReason"), required: true, minLength: 3 }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/receivables/{itemId}/actions/request-write-off", {
                params: { path: { itemId: writingOff.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason },
              });
              invalidateMoney(queryClient);
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
              toast.success(t("writeOffSent"));
            } catch (error) {
              toast.error(problemMessage(error, t("writeOffFailed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** Today's date in Bangkok, `YYYY-MM-DD` — a default for a date field, never business-day maths. */
function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/**
 * Aging by customer or company at a date (AgingReportDto): what is not due yet and how long the
 * rest is past due. The totals are the API's; the screen adds nothing up.
 */
export function AgingReport() {
  const t = useTranslations("finance.receivables.aging");
  const format = useFormat();
  const [asOf, setAsOf] = useState(bangkokToday);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "receivable", { aging: asOf }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/receivables/aging", { params: { query: { asOf } } })).data!,
  });

  type Row = Schemas["AgingPartyDto"];
  const columns: DataTableColumn<Row>[] = [
    { id: "party", header: t("party"), cell: (row) => <PartyCell row={row} /> },
    ...BUCKETS.map((bucket): DataTableColumn<Row> => ({
      id: bucket,
      header: t(`buckets.${bucket}`),
      numeric: true,
      cell: (row) =>
        isZeroMoney(row.buckets[bucket]) ? (
          <span className="text-muted">–</span>
        ) : (
          <span className={bucket === "current" ? undefined : "text-danger"}>{format.thb(row.buckets[bucket])}</span>
        ),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("title")}
        description={t("description")}
        actions={
          <Field label={t("asOf")} className="w-44">
            <Input
              type="date"
              value={asOf}
              max={bangkokToday()}
              onChange={(event) => setAsOf(event.target.value || bangkokToday())}
            />
          </Field>
        }
      >
        {query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <dl className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {BUCKETS.map((bucket) => (
                <Figure
                  key={bucket}
                  label={t(`buckets.${bucket}`)}
                  amount={query.data?.totals[bucket]}
                  tone={bucket !== "current" && !isZeroMoney(query.data?.totals[bucket]) ? "danger" : undefined}
                />
              ))}
            </dl>
            <DataTable
              caption={t("title")}
              columns={columns}
              rows={query.data?.parties ?? []}
              loading={query.isPending}
              getRowId={(row) => row.companyId ?? row.customerId}
              density="compact"
              empty={<EmptyState icon="coins" title={t("empty")} />}
            />
          </>
        )}
      </Section>
      <Allowance />
    </div>
  );
}

/**
 * The allowance for doubtful accounts at a date (P30): from the ⚖ setting
 * `receivables.allowance_rates` when it is set, otherwise the target Finance enters. The API
 * posts only the change.
 */
function Allowance() {
  const t = useTranslations("finance.receivables.allowance");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const canManage = useCan("receivables.manage");
  const queryClient = useQueryClient();
  const [asOf, setAsOf] = useState(bangkokToday);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Schemas["ProvisionResultDto"] | null>(null);

  if (!canManage) return null;
  return (
    <Section title={t("title")} description={`${t("description")} ${t("targetHint")}`}>
      <div className="grid gap-3 sm:grid-cols-[12rem_14rem_auto] sm:items-end">
        <Field label={t("asOf")}>
          <Input type="date" value={asOf} max={bangkokToday()} onChange={(event) => setAsOf(event.target.value)} />
        </Field>
        <Field label={t("target")} error={error ?? undefined} requiredLabel={tCommon("state.required")}>
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <div>
          <Button
            onClick={() => {
              if (amount.trim() && !moneyText(amount)) setError(t("badAmount"));
              else setConfirming(true);
            }}
          >
            {t("update")}
          </Button>
        </div>
      </div>
      {result ? (
        <Callout tone="success" className="mt-4" title={t("posted", { target: format.thb(result.targetAmount) })}>
          {t("postedBody", { change: format.thb(result.amount), method: result.method })}
        </Callout>
      ) : null}
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={
          amount.trim()
            ? t("confirmBody", { asOf: format.date(asOf), amount: format.thb(moneyText(amount)) })
            : t("confirmBodyRates", { asOf: format.date(asOf) })
        }
        confirmLabel={t("update")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/receivables/allowance", {
              params: { header: { "Idempotency-Key": idempotencyKey } },
              body: { asOf, ...(amount.trim() ? { amount: moneyText(amount)! } : {}) },
            });
            setResult(data ?? null);
            setError(null);
            invalidateMoney(queryClient);
          } catch (failure) {
            toast.error(problemMessage(failure, t("failed")));
            throw failure;
          }
        }}
      />
    </Section>
  );
}

/**
 * Customers' 50 ทวิ for tax they withheld (accounting-design §2): chased until received, then
 * recorded with the certificate number, its date and the uploaded copy (a financial record).
 */
export function WhtCertificates({ initial }: { initial: InitialPage<WhtCertificate> | null }) {
  const t = useTranslations("finance.receivables.wht");
  const format = useFormat();
  const canManage = useCan("receivables.manage");
  const [recording, setRecording] = useState<WhtCertificate | null>(null);
  const [waiving, setWaiving] = useState<WhtCertificate | null>(null);
  const queryClient = useQueryClient();

  const columns: DataTableColumn<WhtCertificate>[] = [
    { id: "receipt", header: t("columns.receipt"), cell: (row) => <DocumentLink document={row.receipt} /> },
    { id: "party", header: t("columns.party"), cell: (row) => <PartyCell row={row} /> },
    { id: "whtBase", header: t("columns.base"), numeric: true, cell: (row) => format.thb(row.whtBase) },
    { id: "whtAmount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.whtAmount) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={WHT_CERTIFICATE_STATUS} value={row.status} />,
    },
    {
      id: "certificate",
      header: t("columns.certificate"),
      cell: (row) =>
        row.certificateNo ? (
          <span>
            <span className="font-mono">{row.certificateNo}</span>
            <span className="text-muted block text-xs">{format.date(row.certificateDate)}</span>
          </span>
        ) : (
          "–"
        ),
    },
    { id: "createdAt", header: t("columns.since"), sortable: true, cell: (row) => <When at={row.createdAt} /> },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canManage && row.status === "pending" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setRecording(row)}>
              {t("record")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWaiving(row)}>
              {t("waive")}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          // No `status` in the URL is the list's default: the certificates still awaited.
          { value: null, label: t("pending"), countKey: "finance.wht_certificates_missing" },
          { value: "received", label: t("received") },
          { value: "waived", label: t("waived") },
        ]}
      />
      <ResourceList
        resource={whtCertificatesList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        exportable
        empty={{ title: t("empty") }}
      />
      {recording ? <RecordCertificate certificate={recording} onClose={() => setRecording(null)} /> : null}
      {waiving ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setWaiving(null))}
          title={t("waiveTitle")}
          description={t("waiveBody", { number: waiving.receipt.docNumber, amount: format.thb(waiving.whtAmount) })}
          confirmLabel={t("waive")}
          tone="destructive"
          reason={{ label: t("waiveReason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST(
                "/v1/admin/customer-wht-certificates/{certificateId}/actions/waive",
                {
                  params: { path: { certificateId: waiving.id } },
                  body: { reason },
                },
              );
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "customer-wht-certificate") });
              void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
              toast.success(t("waived"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RecordCertificate({ certificate, onClose }: { certificate: WhtCertificate; onClose: () => void }) {
  const t = useTranslations("finance.receivables.wht.recordForm");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <FormDialog
      title={t("title", { number: certificate.receipt.docNumber })}
      description={t("description", {
        amount: format.thb(certificate.whtAmount),
        base: format.thb(certificate.whtBase),
      })}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        if (!number.trim()) throw new FormError(t("needNumber"));
        if (!date) throw new FormError(t("needDate"));
        const uploaded = file ? await uploadFile("admin", file, "document") : null;
        await adminBrowserApis().contract.POST("/v1/admin/customer-wht-certificates/{certificateId}/actions/record", {
          params: { path: { certificateId: certificate.id } },
          body: { certificateNo: number.trim(), certificateDate: date, ...(uploaded ? { fileId: uploaded.id } : {}) },
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "customer-wht-certificate") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
        toast.success(t("saved"));
      }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t("number")} required requiredLabel={tCommon("state.required")}>
          <Input value={number} onChange={(event) => setNumber(event.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("date")} required requiredLabel={tCommon("state.required")}>
          <Input type="date" value={date} max={bangkokToday()} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={t("copy")} hint={t("copyHint")}>
          <FileDropzone
            accept="application/pdf,image/*"
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
      </div>
    </FormDialog>
  );
}

/** The companies with credit terms, for the statement and dunning pickers (CONTRACT-REQUEST admin.companies). */
function useCreditCompanies() {
  return useQuery({
    queryKey: queryKeys.list("admin", "company", { picker: "credit" }),
    queryFn: () => browserRequests().call("GET /v1/admin/companies", { query: { perPage: 100 } }),
    select: (page) => page.data.filter((company) => company.status === "active"),
  });
}

/**
 * The monthly statement of a B2B company (D-125, StatementDto): every order on credit terms up to
 * the month, what was paid and what is still open — for consolidated payment.
 */
export function CompanyStatements() {
  const t = useTranslations("finance.receivables.statements");
  const format = useFormat();
  const companies = useCreditCompanies();
  const [companyId, setCompanyId] = useState<string>("");
  const [month, setMonth] = useState(() => bangkokToday().slice(0, 7));
  const chosen = companyId || companies.data?.[0]?.id || "";
  const statement = useQuery({
    queryKey: queryKeys.related("admin", "company", chosen, `statement:${month}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/statement", {
          params: { path: { companyId: chosen }, query: { month } },
        })
      ).data!,
    enabled: Boolean(chosen),
  });
  type Line = Schemas["StatementLineDto"];
  const columns: DataTableColumn<Line>[] = [
    { id: "groupCode", header: t("order"), cell: (row) => <span className="font-mono text-sm">{row.groupCode}</span> },
    { id: "poNumber", header: t("po"), cell: (row) => row.poNumber ?? "–" },
    { id: "branch", header: t("branch"), cell: (row) => row.branchCode ?? "–" },
    { id: "placedAt", header: t("placedAt"), cell: (row) => format.date(row.placedAt) },
    { id: "dueAt", header: t("dueAt"), cell: (row) => format.date(row.dueAt) },
    { id: "gross", header: t("gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
    { id: "open", header: t("open"), numeric: true, cell: (row) => format.thb(row.openAmount) },
  ];

  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("company")} className="w-72">
            <Select
              value={chosen || undefined}
              onValueChange={setCompanyId}
              placeholder={t("pickCompany")}
              options={(companies.data ?? []).map((company) => ({
                value: company.id,
                label: `${company.legalName} · ${company.companyCode}`,
              }))}
            />
          </Field>
          <Field label={t("month")} className="w-44">
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value || month)} />
          </Field>
        </div>
      }
    >
      {statement.isError ? (
        <QueryError error={statement.error} onRetry={() => void statement.refetch()} />
      ) : (
        <>
          <dl className="mb-4 grid gap-3 sm:grid-cols-3">
            <Figure label={t("totalGross")} amount={statement.data?.totalGrossAmount} />
            <Figure label={t("totalPaid")} amount={statement.data?.totalPaidAmount} tone="success" />
            <Figure
              label={t("openBalance")}
              amount={statement.data?.openBalance}
              tone={isZeroMoney(statement.data?.openBalance) ? undefined : "danger"}
            />
          </dl>
          <DataTable
            caption={t("title")}
            columns={columns}
            rows={statement.data?.lines ?? []}
            loading={statement.isPending && Boolean(chosen)}
            getRowId={(row) => row.groupId}
            density="compact"
            empty={<EmptyState icon="document" title={t("empty")} />}
          />
        </>
      )}
    </Section>
  );
}

/** Reminders sent for what is owed (D-122; CONTRACT-REQUEST admin.dunning-log), newest first. */
export function DunningLog({
  initial,
  customerId,
}: {
  initial?: InitialPage<DunningEntry> | null;
  customerId?: string;
}) {
  const t = useTranslations("finance.receivables.dunning");
  const columns: DataTableColumn<DunningEntry>[] = [
    { id: "sentAt", header: t("sentAt"), cell: (row) => <When at={row.sentAt} /> },
    {
      id: "document",
      header: t("document"),
      cell: (row) => <DocumentLink document={{ id: row.documentId, docNumber: row.docNumber }} />,
    },
    { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { id: "channel", header: t("channel"), cell: (row) => t(`channels.${row.channel}`) },
    { id: "recipient", header: t("recipient"), cell: (row) => row.recipient },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={DUNNING_STATUS} value={row.status} /> },
  ];
  const scoped = useQuery({
    queryKey: queryKeys.list("admin", "dunning", { customerId }),
    queryFn: () => browserRequests().call("GET /v1/admin/dunning-log", { query: { customerId, perPage: 50 } }),
    enabled: Boolean(customerId),
  });
  if (customerId)
    return (
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={scoped.data?.data ?? []}
        loading={scoped.isPending}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="send" title={t("empty")} />}
      />
    );
  return (
    <ResourceList
      resource={dunningList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      rowTone={(row) => (row.status === "failed" ? "warning" : undefined)}
      empty={{ title: t("empty") }}
    />
  );
}

/**
 * One customer's balance (or their company's): aging buckets, open items, store credit,
 * documents and reminders — every figure a link one step down.
 */
export function PartyBalance({ customerId }: { customerId: string }) {
  const t = useTranslations("finance.receivables.party");
  const tAging = useTranslations("finance.receivables.aging");
  const tDocs = useTranslations("finance.documents");
  const format = useFormat();
  const aging = useQuery({
    queryKey: queryKeys.list("admin", "receivable", { aging: "today" }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/receivables/aging", {})).data!,
    select: (report) => report.parties.find((party) => party.customerId === customerId) ?? null,
  });
  const items = useQuery({
    queryKey: queryKeys.list("admin", "receivable", { customerId }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/receivables", {
          params: { query: { customerId, perPage: 100 } },
        })
      ).data!,
  });
  const credit = useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId, "store-credit"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/store-credit", {
          params: { path: { customerId } },
        })
      ).data!,
  });
  const documents = useQuery({
    queryKey: queryKeys.list("admin", "customer-document", { customerId }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents", {
          params: { query: { customerId, perPage: 20, sort: "issuedAt", order: "desc" } },
        })
      ).data!,
  });
  const name =
    aging.data?.companyName ??
    aging.data?.customerName ??
    items.data?.data[0]?.companyName ??
    items.data?.data[0]?.customerName;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold">{name ?? t("title")}</h1>
        <p className="text-muted mt-1 text-sm">
          <Link href={`/customers/${customerId}`} className="text-primary hover:underline">
            {t("openCustomer")}
          </Link>
          {aging.data?.companyId ? (
            <>
              {" · "}
              <Link href={`/companies/${aging.data.companyId}`} className="text-primary hover:underline">
                {t("openCompany")}
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <Section title={t("aging")}>
        <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {BUCKETS.map((bucket) => (
            <Figure
              key={bucket}
              label={tAging(`buckets.${bucket}`)}
              amount={aging.data?.buckets[bucket] ?? "0.00"}
              tone={bucket !== "current" && !isZeroMoney(aging.data?.buckets[bucket]) ? "danger" : undefined}
            />
          ))}
        </dl>
      </Section>

      <Section title={t("items")}>
        <DataTable
          caption={t("items")}
          density="compact"
          rows={items.data?.data ?? []}
          loading={items.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="coins" title={t("noItems")} />}
          columns={[
            { id: "document", header: t("document"), cell: (row) => <DocumentLink document={row.document} /> },
            { id: "dueDate", header: t("dueDate"), cell: (row) => format.date(row.dueDate) },
            { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
            { id: "open", header: t("open"), numeric: true, cell: (row) => format.thb(row.openAmount) },
            {
              id: "status",
              header: t("status"),
              cell: (row) => <StatusChip map={RECEIVABLE_STATUS} value={row.status} />,
            },
          ]}
        />
      </Section>

      <Section title={t("storeCredit")} description={t("storeCreditNote")}>
        {credit.isError ? (
          <QueryError error={credit.error} onRetry={() => void credit.refetch()} />
        ) : (
          <>
            <dl className="mb-3 grid max-w-xs">
              <Figure label={t("balance")} amount={credit.data?.balance} />
            </dl>
            <DataTable
              caption={t("storeCredit")}
              density="compact"
              rows={credit.data?.entries ?? []}
              loading={credit.isPending}
              getRowId={(row) => row.id}
              empty={<EmptyState icon="wallet" title={t("noCredit")} />}
              columns={[
                { id: "createdAt", header: t("date"), cell: (row) => <When at={row.createdAt} absoluteOnly /> },
                { id: "source", header: t("source"), cell: (row) => t(`sources.${row.source}`) },
                { id: "doc", header: t("document"), cell: (row) => row.docNumber ?? "–" },
                { id: "order", header: t("order"), cell: (row) => row.orderCode ?? "–" },
                { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
              ]}
            />
          </>
        )}
      </Section>

      <Section title={t("documents")}>
        <DataTable
          caption={t("documents")}
          density="compact"
          rows={documents.data?.data ?? []}
          loading={documents.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="document" title={t("noDocuments")} />}
          columns={[
            { id: "number", header: t("document"), cell: (row) => <DocumentLink document={row} /> },
            { id: "type", header: t("type"), cell: (row) => tDocs(`types.${row.docType}`) },
            { id: "date", header: t("date"), cell: (row) => format.date(row.documentDate) },
            { id: "gross", header: t("amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
            {
              id: "status",
              header: t("status"),
              cell: (row) => <StatusChip map={DOCUMENT_STATUS} value={row.status} />,
            },
          ]}
        />
      </Section>

      <Section title={t("dunning")}>
        <DunningLog customerId={customerId} />
      </Section>
    </div>
  );
}
