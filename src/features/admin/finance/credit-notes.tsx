"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CREDIT_NOTE_REQUEST_STATUS } from "@/domain/status";
import { isZeroMoney, moneyText } from "@/domain/money";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { SearchInput } from "@/ui/components/SearchInput";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Stepper, type StepStatus } from "@/ui/components/Stepper";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { useDebouncedValue } from "../console/filters";
import { Section } from "../console/FormDialog";
import { problemMessage } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { StatusChip } from "../console/StatusChip";
import { useReasons } from "./documents";
import { CN_KINDS, creditRequestsList, type CreditNoteRequest, type CustomerDocument } from "./resources";
import { DocumentLink, fieldErrorsOf } from "./shared";
import { invalidateMoney } from "./slips";

type CnKind = Schemas["CreditNoteKind"];
type Settlement = Schemas["CreditSettlement"];

/** Credit notes asked for, and what became of them: issued only once a Finance Manager approves (D-169). */
export function CreditNoteRequests({ initial }: { initial: InitialPage<CreditNoteRequest> | null }) {
  const t = useTranslations("finance.creditNotes");
  const tDocs = useTranslations("finance.documents");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canRequest = useCan("credit_notes.request");

  const columns: DataTableColumn<CreditNoteRequest>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      cell: (row) => (
        <div>
          <Link
            href={`/orders/${row.orderId}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.orderCode}
          </Link>
          <p className="text-muted text-xs">{tDocs(`cnKinds.${row.cnKind}`)}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={CREDIT_NOTE_REQUEST_STATUS} value={row.status} />,
    },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    {
      id: "settleTo",
      header: t("columns.settleTo"),
      cell: (row) => (row.settleTo ? t(`settlements.${row.settleTo}`) : "–"),
    },
    { id: "note", header: t("columns.note"), cell: (row) => <span className="line-clamp-2">{row.note}</span> },
    {
      id: "result",
      header: t("columns.result"),
      cell: (row) =>
        row.creditNote ? (
          <DocumentLink document={row.creditNote} />
        ) : row.approvalRequestId ? (
          <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary hover:underline">
            {t("openApproval")}
          </Link>
        ) : (
          "–"
        ),
    },
    { id: "createdAt", header: t("columns.requested"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <ResourceList
      resource={creditRequestsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: (["pending_approval", "issued", "rejected", "withdrawn"] as const).map((value) => ({
            value,
            label: tStatus(CREDIT_NOTE_REQUEST_STATUS[value].labelKey),
          })),
        },
      ]}
      toolbarEnd={
        canRequest ? (
          <Button asChild size="sm" iconStart="plus">
            <Link href="/finance/credit-notes/new">{t("new")}</Link>
          </Button>
        ) : null
      }
      empty={{ title: t("empty") }}
    />
  );
}

type Step = "invoice" | "reason" | "amount" | "review";
const STEPS: Step[] = ["invoice", "reason", "amount", "review"];

/**
 * The credit-note wizard (accounting-design §2, §8): the tax invoice it goes against, a kind from
 * the controlled list with its statutory reason, the amount (gross, never more than was invoiced
 * less earlier credits — the API checks) and where the credit goes, then a typed confirmation.
 * It is a *request*: a Finance Manager other than the requester approves it in the inbox, and
 * only then is the CN numbered and posted.
 */
export function CreditNoteWizard({ orderId }: { orderId: string | null }) {
  const t = useTranslations("finance.creditNotes.wizard");
  const tDocs = useTranslations("finance.documents");
  const tCredit = useTranslations("finance.creditNotes");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reasons = useReasons();
  const [current, setCurrent] = useState<Step>("invoice");
  const [q, setQ] = useState("");
  const [search, setSearch] = useDebouncedValue(q, setQ);
  const [invoice, setInvoice] = useState<CustomerDocument | null>(null);
  const [kind, setKind] = useState<CnKind | null>(null);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [settleTo, setSettleTo] = useState<Settlement>("store_credit");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  // The order's tax invoices when the wizard is opened from one; otherwise a search over TRs.
  const candidates = useQuery({
    queryKey: queryKeys.list("admin", "customer-document", { docType: "tr", orderId, q, wizard: true }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents", {
          params: {
            query: {
              docType: "tr",
              status: "issued",
              perPage: 10,
              ...(orderId ? { orderId } : {}),
              ...(q ? { q } : {}),
            },
          },
        })
      ).data!,
    enabled: Boolean(orderId) || q.trim().length >= 2,
    select: (page) => page.data.filter((doc) => doc.orderId),
  });

  const creditReasons = (reasons.data ?? []).filter((reason) => reason.direction === "credit");
  const reasonName = (code: string) => {
    const found = creditReasons.find((reason) => reason.code === code);
    return found ? (format.locale === "en" ? found.nameEn : found.nameTh) : code;
  };

  const done: Record<Step, boolean> = {
    invoice: Boolean(invoice),
    reason: Boolean(kind),
    amount: Boolean(moneyText(amount)) && !isZeroMoney(moneyText(amount)) && note.trim().length >= 3,
    review: false,
  };
  const statusOf = (step: Step): StepStatus =>
    step === current ? "current" : errors[step] ? "error" : done[step] ? "complete" : "upcoming";

  const next = (step: Step) => {
    const index = STEPS.indexOf(step);
    setCurrent(STEPS[index + 1] ?? step);
  };

  const content: Record<Step, React.ReactNode> = {
    invoice: (
      <div className="flex flex-col gap-3">
        {orderId ? null : (
          <Field label={t("search")} hint={t("searchHint")}>
            <SearchInput value={search} onValueChange={setSearch} clearLabel={t("clearSearch")} />
          </Field>
        )}
        {candidates.data?.length === 0 ? <p className="text-muted text-sm">{t("noInvoices")}</p> : null}
        <ul className="flex flex-col gap-2">
          {(candidates.data ?? []).map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                aria-pressed={invoice?.id === doc.id}
                onClick={() => {
                  setInvoice(doc);
                  next("invoice");
                }}
                className="border-border hover:bg-surface-subtle aria-pressed:border-primary aria-pressed:bg-primary-subtle flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-md border p-3 text-start text-sm"
              >
                <span className="font-mono font-medium">{doc.docNumber}</span>
                <span className="text-muted">{tDocs(`kinds.${doc.docKind}`)}</span>
                <span className="font-mono">{doc.orderCode}</span>
                <span className="min-w-0 truncate">{doc.buyer.name}</span>
                <span className="ms-auto tabular-nums">{format.thb(doc.grossAmount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    ),
    reason: (
      <div className="flex flex-col gap-4">
        <Field label={t("kind")} hint={t("kindHint")}>
          <RadioCards<CnKind>
            columns={2}
            value={kind ?? undefined}
            onValueChange={(value) => {
              setKind(value);
              setReasonCode("");
            }}
            options={CN_KINDS.map((value) => ({
              value,
              label: tDocs(`cnKinds.${value}`),
              description: t(`kindHints.${value}`),
            }))}
          />
        </Field>
        {kind ? (
          <Field label={t("reason")} hint={t("reasonHint")}>
            <SearchableSelect
              value={reasonCode || "default"}
              onValueChange={(value) => setReasonCode(value === "default" ? "" : value)}
              options={[
                { value: "default", label: t("defaultReason") },
                ...creditReasons.map((reason) => ({
                  value: reason.code,
                  label: format.locale === "en" ? reason.nameEn : reason.nameTh,
                })),
              ]}
            />
          </Field>
        ) : null}
        <div>
          <Button disabled={!kind} onClick={() => next("reason")}>
            {t("next")}
          </Button>
        </div>
      </div>
    ),
    amount: (
      <div className="flex flex-col gap-4">
        {invoice ? (
          <p className="text-muted text-sm">
            {t("invoiced", { number: invoice.docNumber, amount: format.thb(invoice.grossAmount) })}
          </p>
        ) : null}
        <Field
          label={t("amount")}
          hint={t("amountHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.amount}
        >
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label={t("settleTo")} hint={t("settleToHint")}>
          <RadioCards<Settlement>
            columns={2}
            value={settleTo}
            onValueChange={setSettleTo}
            options={(["store_credit", "receivable"] as const).map((value) => ({
              value,
              label: tCredit(`settlements.${value}`),
              description: t(`settlementHints.${value}`),
            }))}
          />
        </Field>
        <Callout tone="info" title={t("refundTitle")}>
          {t("refundBody")}
        </Callout>
        <Field label={t("note")} required requiredLabel={tCommon("state.required")} error={errors.note}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </Field>
        <div>
          <Button
            onClick={() => {
              const nextErrors: Record<string, string> = {};
              if (!moneyText(amount) || isZeroMoney(moneyText(amount))) nextErrors.amount = t("needAmount");
              if (note.trim().length < 3) nextErrors.note = t("needNote");
              setErrors(nextErrors);
              if (Object.keys(nextErrors).length === 0) next("amount");
            }}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    ),
    review: (
      <div className="flex flex-col gap-4">
        <DescriptionList
          columns={2}
          items={[
            { term: t("invoice"), description: invoice ? <span className="font-mono">{invoice.docNumber}</span> : "—" },
            { term: t("order"), description: invoice?.orderCode ?? "—" },
            { term: t("buyer"), description: invoice?.buyer.name ?? "—" },
            { term: t("kind"), description: kind ? tDocs(`cnKinds.${kind}`) : "—" },
            { term: t("reason"), description: reasonCode ? reasonName(reasonCode) : t("defaultReason") },
            { term: t("amount"), description: <span className="tabular-nums">{format.thb(moneyText(amount))}</span> },
            { term: t("settleTo"), description: tCredit(`settlements.${settleTo}`) },
            { term: t("note"), description: note, wide: true },
          ]}
        />
        <Callout tone="warning" title={t("approvalTitle")}>
          {t("approvalBody")}
        </Callout>
        <div>
          <Button disabled={!invoice || !kind || !done.amount} onClick={() => setConfirming(true)}>
            {t("submit")}
          </Button>
        </div>
      </div>
    ),
  };

  return (
    <Section title={t("title")} description={t("description")}>
      <Stepper
        aria-label={t("stepsLabel")}
        headingLevel={2}
        current={current}
        onSelect={(id) => setCurrent(id as Step)}
        labels={{
          complete: t("stepper.complete"),
          error: t("stepper.error"),
          stepOf: (index, total) => t("stepper.stepOf", { index, total }),
        }}
        steps={STEPS.map((step) => ({
          id: step,
          label: t(`steps.${step}`),
          summary:
            step === "invoice" && invoice
              ? invoice.docNumber
              : step === "reason" && kind
                ? tDocs(`cnKinds.${kind}`)
                : step === "amount" && done.amount
                  ? format.thb(moneyText(amount))
                  : undefined,
          status: statusOf(step),
          content: content[step],
        }))}
      />
      {invoice && kind ? (
        <ConfirmAction
          open={confirming}
          onOpenChange={setConfirming}
          title={t("confirmTitle")}
          description={t("confirmBody", {
            order: invoice.orderCode ?? "",
            number: invoice.docNumber,
            amount: format.thb(moneyText(amount)),
          })}
          confirmLabel={t("submit")}
          confirmationPhrase={invoice.orderCode ?? invoice.docNumber}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/credit-notes", {
                params: { path: { orderId: invoice.orderId! }, header: { "Idempotency-Key": idempotencyKey } },
                body: {
                  amount: moneyText(amount)!,
                  cnKind: kind,
                  note: note.trim(),
                  settleTo,
                  ...(reasonCode ? { reasonCode } : {}),
                },
              });
              invalidateMoney(queryClient);
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "credit-note-request") });
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
              toast.success(t("sent", { order: data?.orderCode ?? "" }));
              router.push("/finance/credit-notes");
            } catch (error) {
              const fields = fieldErrorsOf(error);
              setErrors(fields);
              if (fields.amount) setCurrent("amount");
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </Section>
  );
}
