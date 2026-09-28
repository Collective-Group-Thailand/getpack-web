"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PAYMENT_STATUS, REFUND_STATUS, SLIP_STATUS } from "@/domain/status";
import { isZeroMoney, moneyText } from "@/domain/money";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";

import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { StatusChip } from "../console/StatusChip";
import { REFUND_STATUSES, paymentsList, refundsList, type Payment, type Refund } from "./resources";
import { DocumentLink, fieldErrorsOf } from "./shared";
import { invalidateMoney } from "./slips";

const METHODS = [
  "scb_qr",
  "scb_qr_cross_bank",
  "card_2c2p",
  "online_banking_2c2p",
  "bank_transfer_slip",
  "credit_term_transfer",
  "store_credit",
] as const satisfies readonly Schemas["PaymentMethod"][];
const PAYMENT_STATUSES = [
  "awaiting_verification",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
  "expired",
] as const satisfies readonly Schemas["PaymentStatus"][];

/** Every payment the books know (B5.2): gateway, slip, transfer, store credit — with what was refunded. */
export function PaymentsList({ initial }: { initial: InitialPage<Payment> | null }) {
  const t = useTranslations("finance.payments");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<Payment>[] = [
    {
      id: "referenceCode",
      header: t("columns.reference"),
      cell: (row) => (
        <div>
          <Link
            href={`/finance/payments/${row.id}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.referenceCode}
          </Link>
          <p className="text-muted text-xs">{t(`methods.${row.method}`)}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PAYMENT_STATUS} value={row.status} />,
    },
    { id: "amount", header: t("columns.amount"), numeric: true, sortable: true, cell: (row) => format.thb(row.amount) },
    {
      id: "refunded",
      header: t("columns.refunded"),
      numeric: true,
      hideable: true,
      cell: (row) =>
        isZeroMoney(row.refundedAmount) ? <span className="text-muted">–</span> : format.thb(row.refundedAmount),
    },
    { id: "providerRef", header: t("columns.providerRef"), hideable: true, cell: (row) => row.providerRef ?? "–" },
    { id: "paidAt", header: t("columns.paidAt"), sortable: true, cell: (row) => <When at={row.paidAt} /> },
  ];

  return (
    <ResourceList
      resource={paymentsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: PAYMENT_STATUSES.map((value) => ({ value, label: tStatus(PAYMENT_STATUS[value].labelKey) })),
        },
        {
          id: "method",
          label: t("columns.method"),
          kind: "select",
          options: METHODS.map((value) => ({ value, label: t(`methods.${value}`) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}

/**
 * One payment and what came of it: its slips and their checks, the documents it produced (the
 * TR or RC), and its refunds — each a step of the drill-down. A refund is requested here and
 * approved by a Finance Manager other than the requester (D-169).
 */
export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const t = useTranslations("finance.payments.detail");
  const tList = useTranslations("finance.payments");
  const tFinance = useTranslations("finance.common");
  const format = useFormat();
  const canRefund = useCan("refunds.request");
  const [refunding, setRefunding] = useState(false);

  const payment = useQuery({
    queryKey: queryKeys.detail("admin", "payment", paymentId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/payments/{paymentId}", { params: { path: { paymentId } } }))
        .data!,
  });
  const documents = useQuery({
    queryKey: queryKeys.related("admin", "payment", paymentId, "documents"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents", {
          // CONTRACT-REQUEST admin.document-payment-filter: the list has no `paymentId` filter yet,
          // so the one extra parameter is cast here; the rows are still filtered by it below.
          params: { query: { paymentId, perPage: 50 } as never },
        })
      ).data!,
    select: (page) => page.data.filter((doc) => doc.paymentId === paymentId),
  });
  const refunds = useQuery({
    queryKey: queryKeys.related("admin", "payment", paymentId, "refunds"),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/refunds", { params: { query: { perPage: 100 } } })).data!,
    select: (page) => page.data.filter((refund) => refund.paymentId === paymentId),
  });

  if (payment.isError) return <QueryError error={payment.error} onRetry={() => void payment.refetch()} />;
  const data = payment.data;
  if (!data) return null;
  const refundable = ["succeeded", "partially_refunded"].includes(data.status);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: tList("title"), href: "/finance/payments" }, { label: data.referenceCode }]}
          />
        }
        title={t("title", { reference: data.referenceCode })}
        meta={
          <>
            <StatusChip map={PAYMENT_STATUS} value={data.status} size="md" />
            <span className="text-muted text-sm">{tList(`methods.${data.method}`)}</span>
          </>
        }
        actions={
          canRefund && refundable ? (
            <Button variant="secondary" iconStart="reset" onClick={() => setRefunding(true)}>
              {t("requestRefund")}
            </Button>
          ) : null
        }
      />

      <Section title={t("summary")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("amount"), description: <span className="tabular-nums">{format.thb(data.amount)}</span> },
            { term: t("cash"), description: <span className="tabular-nums">{format.thb(data.cashAmount)}</span> },
            { term: t("wht"), description: <span className="tabular-nums">{format.thb(data.whtAmount)}</span> },
            { term: t("fee"), description: <span className="tabular-nums">{format.thb(data.feeAmount)}</span> },
            {
              term: t("refunded"),
              description: <span className="tabular-nums">{format.thb(data.refundedAmount)}</span>,
            },
            { term: t("provider"), description: `${data.provider}${data.providerRef ? ` · ${data.providerRef}` : ""}` },
            { term: t("paidAt"), description: <When at={data.paidAt} absoluteOnly /> },
            { term: t("createdAt"), description: <When at={data.createdAt} absoluteOnly /> },
            {
              term: t("group"),
              description: data.groupId ? (
                <Link
                  href={`/orders?q=${encodeURIComponent(data.referenceCode)}`}
                  className="text-primary hover:underline"
                >
                  {t("openOrders")}
                </Link>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Section>

      {data.slips.length > 0 ? (
        <Section title={t("slips")}>
          <DataTable
            caption={t("slips")}
            density="compact"
            rows={data.slips}
            getRowId={(row) => row.id}
            columns={[
              { id: "declared", header: t("declared"), numeric: true, cell: (row) => format.thb(row.declaredAmount) },
              {
                id: "transferredAt",
                header: t("transferredAt"),
                cell: (row) => <When at={row.declaredTransferredAt} absoluteOnly />,
              },
              {
                id: "check",
                header: t("check"),
                cell: (row) => (row.lastCheck ? tFinance(`checks.${row.lastCheck}`) : "—"),
              },
              { id: "status", header: t("status"), cell: (row) => <StatusChip map={SLIP_STATUS} value={row.status} /> },
            ]}
          />
        </Section>
      ) : null}

      <Section title={t("documents")}>
        <DataTable
          caption={t("documents")}
          density="compact"
          rows={documents.data ?? []}
          loading={documents.isPending && Boolean(payment.data)}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="document" title={t("noDocuments")} />}
          columns={[
            { id: "number", header: t("docNumber"), cell: (row) => <DocumentLink document={row} /> },
            { id: "date", header: t("docDate"), cell: (row) => format.date(row.documentDate) },
            { id: "gross", header: t("docGross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
          ]}
        />
      </Section>

      <Section title={t("refunds")}>
        <RefundRows rows={refunds.data ?? []} loading={refunds.isPending} />
      </Section>

      {refunding ? <RequestRefund payment={data} onClose={() => setRefunding(false)} /> : null}
    </div>
  );
}

function RefundRows({
  rows,
  loading,
  onOpen,
}: {
  rows: Refund[];
  loading?: boolean;
  onOpen?: (refund: Refund) => void;
}) {
  const t = useTranslations("finance.refunds");
  const format = useFormat();
  const columns: DataTableColumn<Refund>[] = [
    {
      id: "createdAt",
      header: t("columns.requested"),
      cell: (row) =>
        onOpen ? (
          <button type="button" className="text-primary text-start hover:underline" onClick={() => onOpen(row)}>
            <When at={row.createdAt} absoluteOnly />
          </button>
        ) : (
          <When at={row.createdAt} absoluteOnly />
        ),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={REFUND_STATUS} value={row.status} /> },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    { id: "channel", header: t("columns.channel"), cell: (row) => t(`channels.${row.channel}`) },
    { id: "reason", header: t("columns.reason"), cell: (row) => row.reasonNote },
  ];
  return (
    <DataTable
      caption={t("title")}
      density="compact"
      rows={rows}
      loading={loading}
      getRowId={(row) => row.id}
      columns={columns}
      empty={<EmptyState icon="reset" title={t("empty")} />}
    />
  );
}

/** A refund request (D-169): amount, channel and reason, then the Finance Manager decides. */
function RequestRefund({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const t = useTranslations("finance.refunds.request");
  const tRefunds = useTranslations("finance.refunds");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<Schemas["RefundChannel"]>(
    payment.provider === "2c2p" ? "original_gateway" : "bank_transfer",
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  function check() {
    const next: Record<string, string> = {};
    if (!moneyText(amount) || isZeroMoney(moneyText(amount))) next.amount = t("needAmount");
    if (reason.trim().length < 3) next.reasonNote = t("needReason");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title", { reference: payment.referenceCode })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => (check() ? setConfirming(true) : undefined)}>{t("submit")}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title={t("makerChecker")} />
        <DescriptionList
          columns={2}
          items={[
            { term: t("paid"), description: format.thb(payment.amount) },
            { term: t("alreadyRefunded"), description: format.thb(payment.refundedAmount) },
          ]}
        />
        <Field
          label={t("amount")}
          hint={t("amountHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.amount}
        >
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label={t("channel")} required requiredLabel={tCommon("state.required")}>
          <Select<Schemas["RefundChannel"]>
            value={channel}
            onValueChange={setChannel}
            options={(["original_gateway", "bank_transfer", "store_credit"] as const).map((value) => ({
              value,
              label: tRefunds(`channels.${value}`),
            }))}
          />
        </Field>
        <Field label={t("reason")} required requiredLabel={tCommon("state.required")} error={errors.reasonNote}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </Field>
      </div>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", {
          reference: payment.referenceCode,
          amount: format.thb(moneyText(amount) ?? "0.00"),
        })}
        confirmLabel={t("submit")}
        confirmationPhrase={payment.referenceCode}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/payments/{paymentId}/refunds", {
              params: { path: { paymentId: payment.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { amount: moneyText(amount)!, channel, reasonNote: reason.trim() },
            });
            invalidateMoney(queryClient);
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
    </Sheet>
  );
}

/**
 * Refunds (D-169): each waits for a Finance Manager other than its requester; a bank-transfer
 * refund is then recorded as paid by Finance — someone other than the requester — with the bank
 * reference, which posts P22.
 */
export function RefundsList({ initial }: { initial: InitialPage<Refund> | null }) {
  const t = useTranslations("finance.refunds");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("refund");

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("refund", id);
    else next.delete("refund");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const columns: DataTableColumn<Refund>[] = [
    {
      id: "createdAt",
      header: t("columns.requested"),
      sortable: true,
      cell: (row) => (
        <button type="button" className="text-primary text-start hover:underline" onClick={() => setOpen(row.id)}>
          <When at={row.createdAt} absoluteOnly />
        </button>
      ),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={REFUND_STATUS} value={row.status} /> },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    { id: "channel", header: t("columns.channel"), cell: (row) => t(`channels.${row.channel}`) },
    {
      id: "reason",
      header: t("columns.reason"),
      cell: (row) => <span className="line-clamp-2">{row.reasonNote}</span>,
    },
    {
      id: "payment",
      header: t("columns.payment"),
      cell: (row) => (
        <Link href={`/finance/payments/${row.paymentId}`} className="text-primary hover:underline">
          {t("openPayment")}
        </Link>
      ),
    },
  ];

  return (
    <>
      <ResourceList
        resource={refundsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: REFUND_STATUSES.map((value) => ({ value, label: tStatus(REFUND_STATUS[value].labelKey) })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
      {openId ? <RefundSheet refundId={openId} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function RefundSheet({ refundId, onClose }: { refundId: string; onClose: () => void }) {
  const t = useTranslations("finance.refunds.detail");
  const tRefunds = useTranslations("finance.refunds");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const canComplete = useCan("refunds.complete");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refund = useQuery({
    queryKey: queryKeys.detail("admin", "refund", refundId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/refunds/{refundId}", { params: { path: { refundId } } })).data!,
  });
  const approval = useQuery({
    queryKey: queryKeys.detail("admin", "approval", refund.data?.approvalRequestId ?? "none"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/approvals/{requestId}", {
          params: { path: { requestId: refund.data!.approvalRequestId! } },
        })
      ).data!,
    enabled: Boolean(refund.data?.approvalRequestId),
  });
  const data = refund.data;
  const isRequester = approval.data?.requester.id === actor.id;
  const payable = data?.status === "approved" && data.channel === "bank_transfer";

  return (
    <Sheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      description={data ? t("description", { amount: format.thb(data.amount) }) : undefined}
      closeLabel={tCommon("actions.close")}
      footer={
        payable && canComplete && !isRequester ? (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (!reference.trim()) setError(t("needReference"));
                else setConfirming(true);
              }}
            >
              {t("complete")}
            </Button>
          </div>
        ) : null
      }
    >
      {refund.isError ? (
        <QueryError error={refund.error} onRetry={() => void refund.refetch()} />
      ) : !data ? null : (
        <div className="flex flex-col gap-4">
          <DescriptionList
            columns={2}
            items={[
              { term: t("status"), description: <StatusChip map={REFUND_STATUS} value={data.status} /> },
              { term: t("amount"), description: <span className="tabular-nums">{format.thb(data.amount)}</span> },
              { term: t("channel"), description: tRefunds(`channels.${data.channel}`) },
              { term: t("requestedAt"), description: <When at={data.createdAt} absoluteOnly /> },
              { term: t("requestedBy"), description: approval.data?.requester.displayName ?? "—" },
              {
                term: t("approval"),
                description: data.approvalRequestId ? (
                  <Link href={`/approvals/${data.approvalRequestId}`} className="text-primary hover:underline">
                    {t("openApproval")}
                  </Link>
                ) : (
                  "—"
                ),
              },
              { term: t("providerRef"), description: data.providerRef ?? "—" },
              { term: t("completedAt"), description: <When at={data.completedAt} absoluteOnly /> },
              { term: t("reason"), description: data.reasonNote, wide: true },
            ]}
          />
          {data.status === "pending_approval" ? <Callout tone="warning" title={t("waiting")} /> : null}
          {payable && isRequester ? (
            <Callout tone="info" title={t("notYours")}>
              {t("notYoursBody")}
            </Callout>
          ) : null}
          {payable && canComplete && !isRequester ? (
            <Field
              label={t("reference")}
              hint={t("referenceHint")}
              required
              requiredLabel={tCommon("state.required")}
              error={error ?? undefined}
            >
              <Input
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  setError(null);
                }}
                autoComplete="off"
              />
            </Field>
          ) : null}
        </div>
      )}
      {data ? (
        <ConfirmAction
          open={confirming}
          onOpenChange={setConfirming}
          title={t("confirmTitle")}
          description={t("confirmBody", { amount: format.thb(data.amount), reference: reference.trim() })}
          confirmLabel={t("complete")}
          confirmationPhrase={data.amount}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              const done = await adminBrowserApis().contract.POST("/v1/admin/refunds/{refundId}/actions/complete", {
                params: { path: { refundId: data.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { providerRef: reference.trim() },
              });
              queryClient.setQueryData(queryKeys.detail("admin", "refund", data.id), done.data);
              invalidateMoney(queryClient);
              toast.success(t("completed"));
            } catch (failure) {
              toast.error(problemMessage(failure, t("failed")));
              throw failure;
            }
          }}
        />
      ) : null}
    </Sheet>
  );
}

export { RefundRows };
