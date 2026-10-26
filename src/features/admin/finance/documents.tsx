"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DOCUMENT_STATUS, DUNNING_STATUS, RECEIVABLE_STATUS } from "@/domain/status";
import { isZeroMoney, moneyText } from "@/domain/money";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, Section } from "../console/FormDialog";
import { NextActionBar } from "../console/NextActionBar";
import { problemMessage, QueryError } from "../console/QueryError";
import { QueueTabs } from "../console/queues";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { StatusChip } from "../console/StatusChip";
import { ETaxPanel, ReplaceDialog, ReplacementNotice, ResendETaxDialog } from "./document-corrections";
import { DOC_TYPES, documentsList, type CustomerDocument } from "./resources";
import { DocumentLink, fieldErrorsOf, SourceJournals } from "./shared";
import { invalidateMoney } from "./slips";

/**
 * The customer document registers (accounting-design §4), issued by Collective Group (Thailand)
 * under the getpack brand (D-010, D-092): tax invoice / receipts, invoices, receipts, credit and
 * debit notes. Numbers are gapless per series; a voided document keeps its number and its reason.
 * Quotations (QT) are their own register on the sales side.
 */
export function DocumentsRegister({ initial }: { initial: InitialPage<CustomerDocument> | null }) {
  const t = useTranslations("finance.documents");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<CustomerDocument>[] = [
    {
      id: "docNumber",
      header: t("columns.number"),
      sortable: true,
      cell: (row) => (
        <div>
          <DocumentLink document={row} />
          <p className="text-muted text-xs">{t(`kinds.${row.docKind}`)}</p>
        </div>
      ),
    },
    {
      id: "documentDate",
      header: t("columns.date"),
      sortable: true,
      cell: (row) => <span className="whitespace-nowrap">{format.date(row.documentDate)}</span>,
    },
    {
      id: "buyer",
      header: t("columns.buyer"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.buyer.name}</p>
          {row.buyer.taxId ? <p className="text-muted text-xs tabular-nums">{row.buyer.taxId}</p> : null}
        </div>
      ),
    },
    {
      id: "orderCode",
      header: t("columns.order"),
      hideable: true,
      cell: (row) =>
        row.orderId ? (
          <Link
            href={`/orders/${row.orderId}`}
            className="text-primary text-sm whitespace-nowrap tabular-nums hover:underline"
          >
            {row.orderCode}
          </Link>
        ) : (
          <span className="text-sm whitespace-nowrap tabular-nums">{row.orderCode ?? "–"}</span>
        ),
    },
    {
      id: "netAmount",
      header: t("columns.net"),
      numeric: true,
      hideable: true,
      cell: (row) => format.thb(row.netAmount),
    },
    {
      id: "vatAmount",
      header: t("columns.vat"),
      numeric: true,
      hideable: true,
      cell: (row) => format.thb(row.vatAmount),
    },
    { id: "grossAmount", header: t("columns.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={DOCUMENT_STATUS} value={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("typesLabel")}
        param="docType"
        tabs={[
          { value: null, label: t("all") },
          ...DOC_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) })),
        ]}
      />
      <ResourceList
        resource={documentsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: (["issued", "void"] as const).map((value) => ({
              value,
              label: tStatus(DOCUMENT_STATUS[value].labelKey),
            })),
          },
          { id: "from", label: t("from"), kind: "date" },
          { id: "to", label: t("to"), kind: "date" },
        ]}
        toolbarEnd={
          <Button asChild variant="ghost" size="sm" iconStart="receipt">
            <Link href="/quotations">{t("quotations")}</Link>
          </Button>
        }
        empty={{ title: t("empty") }}
      />
    </div>
  );
}

type Action = "void" | "resend" | "debit" | "replace" | "resend_etax";

/** The verbs of `customer_document.*` this page performs. */
const DOCUMENT_VERBS: ReadonlySet<string> = new Set(["resend", "void", "replace", "resend_etax"]);

/**
 * One customer document as issued: seller and buyer, lines, VAT and withholding, what it deducts,
 * what is still owed — and the steps either side of it: the order, the payment, the original a
 * CN / DN / RC refers to, and the journals it posted.
 */
export function DocumentDetail({ documentId }: { documentId: string }) {
  const t = useTranslations("finance.documents.detail");
  const tDocs = useTranslations("finance.documents");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canCredit = useCan("credit_notes.request");
  const canDebit = useCan("receivables.debit_notes.issue");
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const key = queryKeys.detail("admin", "customer-document", documentId);
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents/{documentId}", {
          params: { path: { documentId } },
        })
      ).data!,
  });

  async function openPdf(download: boolean, cancelled = false) {
    try {
      const { data } = cancelled
        ? await adminBrowserApis().contract.GET("/v1/admin/customer-documents/{documentId}/cancelled-pdf", {
            params: { path: { documentId } },
          })
        : await adminBrowserApis().contract.GET("/v1/admin/customer-documents/{documentId}/pdf", {
            params: { path: { documentId } },
          });
      if (!data) return;
      const link = document.createElement("a");
      link.href = data.url;
      link.rel = "noopener";
      if (download) link.download = `${query.data?.docNumber ?? documentId}.pdf`;
      else link.target = "_blank";
      link.click();
    } catch (error) {
      toast.error(problemMessage(error, t("pdfFailed")));
    }
  }

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const doc = query.data;
  if (!doc) return null;
  const isTaxInvoice = doc.docType === "tr" && doc.status === "issued" && Boolean(doc.orderId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: tDocs("title"), href: "/finance/documents" }, { label: doc.docNumber }]}
          />
        }
        title={`${tDocs(`types.${doc.docType}`)} ${doc.docNumber}`}
        meta={
          <>
            <StatusChip map={DOCUMENT_STATUS} value={doc.status} size="md" />
            <span className="text-muted text-sm">{tDocs(`kinds.${doc.docKind}`)}</span>
            {doc.isFullForm ? <span className="text-muted text-sm">{t("fullForm")}</span> : null}
          </>
        }
        description={t("issuedAt", { at: format.dateTime(doc.issuedAt) })}
        actions={
          <>
            <Button variant="secondary" iconStart="eye" disabled={!doc.pdfReady} onClick={() => void openPdf(false)}>
              {t("preview")}
            </Button>
            <Button
              variant="secondary"
              iconStart="download"
              disabled={!doc.pdfReady}
              onClick={() => void openPdf(true)}
            >
              {t("download")}
            </Button>
            {doc.cancelledPdfReady ? (
              <Button variant="secondary" iconStart="ban" onClick={() => void openPdf(false, true)}>
                {t("cancelledCopy")}
              </Button>
            ) : null}
            {isTaxInvoice && (canCredit || canDebit) ? (
              <DropdownMenu
                label={t("more")}
                trigger={
                  <Button variant="ghost" iconStart="more">
                    {t("more")}
                  </Button>
                }
                items={[
                  ...(canCredit
                    ? [
                        {
                          id: "credit",
                          label: t("creditNote"),
                          icon: "file-check" as const,
                          onSelect: () => router.push(`/finance/credit-notes/new?orderId=${doc.orderId}`),
                        },
                      ]
                    : []),
                  ...(canDebit
                    ? [
                        {
                          id: "debit",
                          label: t("debitNote"),
                          icon: "plus" as const,
                          onSelect: () => setAction("debit"),
                        },
                      ]
                    : []),
                ]}
              />
            ) : null}
            {/* Resend and void are what the API offers on this document, for this person (`nextActions`). */}
            <NextActionBar
              actions={doc.nextActions}
              supported={DOCUMENT_VERBS}
              labelOf={(verb) =>
                verb === "resend"
                  ? t("resend")
                  : verb === "void"
                    ? t("void")
                    : verb === "replace"
                      ? t("replace")
                      : verb === "resend_etax"
                        ? t("resendETax")
                        : undefined
              }
              onAction={(verb) => setAction(verb as Action)}
            />
          </>
        }
      />

      {doc.status === "void" ? (
        <Callout tone="neutral" title={t("voided")}>
          {doc.voidReason}
        </Callout>
      ) : null}
      <ReplacementNotice doc={doc} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("seller")}>
          <Party party={doc.seller} />
        </Section>
        <Section title={t("buyer")}>
          <Party party={doc.buyer} />
        </Section>
      </div>

      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          density="compact"
          rows={doc.lines}
          getRowId={(row) => String(row.lineNo)}
          columns={[
            { id: "lineNo", header: "#", numeric: true, cell: (row) => row.lineNo },
            { id: "description", header: t("description"), cell: (row) => row.description },
            { id: "quantity", header: t("quantity"), numeric: true, cell: (row) => row.quantity },
            {
              id: "discount",
              header: t("discount"),
              numeric: true,
              cell: (row) => (isZeroMoney(row.discountAmount) ? "" : format.thb(row.discountAmount)),
            },
            { id: "net", header: t("net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
            { id: "vat", header: t("vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
            { id: "gross", header: t("gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
          ]}
        />
        <dl className="ms-auto mt-4 grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Total label={t("net")} amount={doc.netAmount} />
          <Total label={t("vatAt", { rate: format.percent(doc.vatRatePct) })} amount={doc.vatAmount} />
          <Total label={t("gross")} amount={doc.grossAmount} strong />
          {isZeroMoney(doc.deductedPriorAmount) ? null : (
            <Total label={t("deductedPrior")} amount={doc.deductedPriorAmount} />
          )}
          {isZeroMoney(doc.whtAmount) ? null : <Total label={t("wht")} amount={doc.whtAmount} />}
          {doc.docType === "tr" || doc.docType === "rc" ? <Total label={t("cash")} amount={doc.cashAmount} /> : null}
          <Total label={t("amountDue")} amount={doc.amountDue} strong />
        </dl>
      </Section>

      <Section title={t("links")}>
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("order"),
              description: doc.orderId ? (
                <Link href={`/orders/${doc.orderId}`} className="text-primary tabular-nums hover:underline">
                  {doc.orderCode}
                </Link>
              ) : (
                (doc.orderCode ?? "—")
              ),
            },
            { term: t("group"), description: doc.groupCode ?? "—" },
            {
              term: t("payment"),
              description: doc.paymentId ? (
                <Link href={`/finance/payments/${doc.paymentId}`} className="text-primary hover:underline">
                  {t("openPayment")}
                </Link>
              ) : (
                "—"
              ),
            },
            { term: t("original"), description: <DocumentLink document={doc.originalDocument} /> },
            {
              term: t("receivable"),
              description: doc.receivable ? (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusChip map={RECEIVABLE_STATUS} value={doc.receivable.status} />
                  <span className="tabular-nums">{format.thb(doc.receivable.openAmount)}</span>
                </span>
              ) : (
                "—"
              ),
            },
            { term: t("dueDate"), description: doc.dueDate ? format.date(doc.dueDate) : "—" },
            { term: t("taxNature"), description: doc.taxNature ? t(`natures.${doc.taxNature}`) : "—" },
            { term: t("receiptVia"), description: doc.receiptVia ? t(`via.${doc.receiptVia}`) : "—" },
            {
              term: t("reason"),
              description: doc.reason ? (
                <ReasonName code={doc.reason} />
              ) : doc.cnKind ? (
                tDocs(`cnKinds.${doc.cnKind}`)
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Section>

      <Section title={t("journals")} description={t("journalsNote")}>
        <SourceJournals sourceType="customer_document" sourceId={doc.id} />
      </Section>

      <ETaxPanel doc={doc} />

      <Section title={t("deliveries")}>
        <Deliveries documentId={doc.id} />
      </Section>

      {action === "void" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("voidTitle")}
          description={t("voidBody", { number: doc.docNumber, amount: format.thb(doc.grossAmount) })}
          confirmLabel={t("void")}
          tone="destructive"
          confirmationPhrase={doc.docNumber}
          reason={{ label: t("voidReason"), required: true, minLength: 3 }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/customer-documents/{documentId}/actions/void",
                {
                  params: { path: { documentId: doc.id }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { reason },
                },
              );
              queryClient.setQueryData(key, data);
              invalidateMoney(queryClient);
              toast.success(t("voidDone", { number: doc.docNumber }));
            } catch (error) {
              toast.error(problemMessage(error, t("voidFailed")));
              throw error;
            }
          }}
        />
      ) : null}
      {action === "resend" ? <Resend doc={doc} onClose={() => setAction(null)} /> : null}
      {action === "debit" ? <DebitNote doc={doc} onClose={() => setAction(null)} /> : null}
      {action === "resend_etax" ? <ResendETaxDialog doc={doc} onClose={() => setAction(null)} /> : null}
      {action === "replace" ? (
        <ReplaceDialog
          doc={doc}
          onClose={() => setAction(null)}
          onReplaced={(next) => {
            setAction(null);
            void queryClient.invalidateQueries({ queryKey: key });
            router.push(`/finance/documents/${next.id}`);
          }}
        />
      ) : null}
    </div>
  );
}

function Party({ party }: { party: Schemas["DocumentPartyDto"] }) {
  const t = useTranslations("finance.documents.detail");
  return (
    <DescriptionList
      columns={1}
      items={[
        { term: t("partyName"), description: party.name },
        { term: t("taxId"), description: party.taxId ? <span className="tabular-nums">{party.taxId}</span> : "—" },
        { term: t("branch"), description: party.branchCode ? t("branchCode", { code: party.branchCode }) : "—" },
        { term: t("address"), description: party.address ?? "—" },
      ]}
    />
  );
}

function Total({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  const format = useFormat();
  return (
    <>
      <dt className={strong ? "font-medium" : "text-muted"}>{label}</dt>
      <dd className={strong ? "text-end font-semibold tabular-nums" : "text-end tabular-nums"}>{format.thb(amount)}</dd>
    </>
  );
}

/**
 * The statutory reason list (`admin.customerDocuments.listCreditNoteReasons`, the §2 controlled
 * list), with each reason's `direction`: credit notes take `credit`, debit notes `debit`. Cached
 * for the session.
 */
export function useReasons() {
  return useQuery({
    queryKey: queryKeys.list("admin", "credit-note-reason"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/credit-note-reasons")).data!,
    staleTime: 60 * 60_000,
  });
}

function ReasonName({ code }: { code: string }) {
  const reasons = useReasons();
  const format = useFormat();
  const reason = reasons.data?.find((item) => item.code === code);
  return <span>{reason ? (format.locale === "en" ? reason.nameEn : reason.nameTh) : code}</span>;
}

function Deliveries({ documentId }: { documentId: string }) {
  const t = useTranslations("finance.documents.detail");
  const query = useQuery({
    queryKey: queryKeys.related("admin", "customer-document", documentId, "deliveries"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents/{documentId}/deliveries", {
          params: { path: { documentId } },
        })
      ).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <DataTable
      caption={t("deliveries")}
      density="compact"
      rows={query.data ?? []}
      loading={query.isPending}
      getRowId={(row) => `${row.kind}:${row.channel}:${row.requestedAt}`}
      empty={<EmptyState icon="send" title={t("noDeliveries")} />}
      columns={[
        { id: "requestedAt", header: t("requestedAt"), cell: (row) => <When at={row.requestedAt} /> },
        { id: "kind", header: t("deliveryKind"), cell: (row) => t(`deliveryKinds.${row.kind}`) },
        { id: "channel", header: t("channel"), cell: (row) => t(`channels.${row.channel}`) },
        // Masked by the API (PDPA).
        { id: "to", header: t("to"), cell: (row) => row.recipient ?? "—" },
        {
          id: "status",
          header: t("deliveryStatus"),
          cell: (row) => <StatusChip map={DUNNING_STATUS} value={row.status} />,
        },
        { id: "sentAt", header: t("sentAt"), cell: (row) => (row.sentAt ? <When at={row.sentAt} /> : "—") },
      ]}
    />
  );
}

/**
 * Sends the document to the customer again (`admin.customerDocuments.resend`, D-143): the API
 * queues it on the customer's own channels and the delivery log shows where it went.
 */
function Resend({ doc, onClose }: { doc: CustomerDocument; onClose: () => void }) {
  const t = useTranslations("finance.documents.resend");
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("title", { number: doc.docNumber })}
      description={t("description")}
      submitLabel={t("send")}
      onClose={onClose}
      onSubmit={async () => {
        await adminBrowserApis().contract.POST("/v1/admin/customer-documents/{documentId}/actions/resend", {
          params: { path: { documentId: doc.id }, header: { "Idempotency-Key": idempotencyKey } },
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.related("admin", "customer-document", doc.id, "deliveries"),
        });
        toast.success(t("sent"));
      }}
    >
      {/* CONTRACT-GAP admin.document-resend — the resend takes no channel and no other address: it goes by the customer's own routes. */}
      <p className="text-muted text-sm">{t("how")}</p>
    </FormDialog>
  );
}

/** A debit note against the order's tax invoice (Finance Manager, `receivables.debit_notes.issue`). */
function DebitNote({ doc, onClose }: { doc: CustomerDocument; onClose: () => void }) {
  const t = useTranslations("finance.documents.debit");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const reasons = useReasons();
  const [net, setNet] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const debitReasons = (reasons.data ?? []).filter((reason) => reason.direction === "debit");

  function review() {
    const next: Record<string, string> = {};
    if (!moneyText(net) || isZeroMoney(moneyText(net))) next.net = t("needNet");
    if (!reasonCode) next.reasonCode = t("needReason");
    if (note.trim().length < 3) next.note = t("needNote");
    setErrors(next);
    if (Object.keys(next).length === 0) setConfirming(true);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { number: doc.docNumber })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={review}>{t("review")}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label={t("net")}
          hint={t("netHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.net}
        >
          <Input inputMode="decimal" value={net} onChange={(event) => setNet(event.target.value)} />
        </Field>
        <Field label={t("reason")} required requiredLabel={tCommon("state.required")} error={errors.reasonCode}>
          <SearchableSelect
            value={reasonCode || undefined}
            onValueChange={setReasonCode}
            placeholder={t("pickReason")}
            options={debitReasons.map((reason) => ({
              value: reason.code,
              label: format.locale === "en" ? reason.nameEn : reason.nameTh,
            }))}
          />
        </Field>
        <Field label={t("note")} required requiredLabel={tCommon("state.required")} error={errors.note}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </Field>
      </div>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", { number: doc.docNumber, amount: format.thb(moneyText(net) ?? "0.00") })}
        confirmLabel={t("issue")}
        confirmationPhrase={doc.orderCode ?? doc.docNumber}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/debit-notes", {
              params: { path: { orderId: doc.orderId! }, header: { "Idempotency-Key": idempotencyKey } },
              body: { net: moneyText(net)!, reasonCode, note: note.trim() },
            });
            invalidateMoney(queryClient);
            toast.success(t("issued"));
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
