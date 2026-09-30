"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { AdminOrderAction } from "@/domain/next-actions/admin";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, NextActionBar, problemMessage } from "../console";
import { SlipReview } from "../finance/slips";
import { useGroupSchedule, type QueuedSlip } from "./data";
import type { Order, OrderGroup } from "./resources";

export type OrderActionKey =
  "approve_slip" | "reject_slip" | "start_production" | "cancel" | "send_payment_reminder" | "record_slip";

const SUPPORTED = new Set<string>([
  "approve_slip",
  "reject_slip",
  "start_production",
  "cancel",
  "send_payment_reminder",
  "record_slip",
]);

/** The order's actions as `adminOrderActions` offers them — see `NextActionBar`. */
export function OrderActionBar({
  actions,
  onAction,
}: {
  actions: AdminOrderAction[];
  onAction: (key: OrderActionKey) => void;
}) {
  const t = useTranslations("orders.actions");
  return (
    <NextActionBar
      actions={actions.map(({ key, irreversible, blockedBy }) => ({
        key,
        irreversible,
        disabledReason: blockedBy ? t(`blocked.${blockedBy}`) : null,
      }))}
      supported={SUPPORTED}
      labelOf={(key) => (t.has(`labels.${key}`) ? t(`labels.${key}`) : undefined)}
      onAction={(key) => onAction(key as OrderActionKey)}
    />
  );
}

type Settle = () => void;

/** The dialog for whichever action is open. One component so every action shares the same rules. */
export function OrderActionDialogs({
  order,
  group,
  customerName,
  open,
  slip,
  onClose,
}: {
  order: Order;
  group: OrderGroup | null;
  customerName: string | null;
  open: OrderActionKey | null;
  slip: QueuedSlip | null;
  onClose: () => void;
}) {
  const t = useTranslations("orders.actions");
  const format = useFormat();
  const queryClient = useQueryClient();
  const orderId = order.id;
  const schedule = useGroupSchedule(group?.id);
  const nextInstalment =
    schedule.data?.instalments.find((instalment) => !["paid", "cancelled", "refunded"].includes(instalment.status)) ??
    null;
  const restated = t("restate", {
    code: order.orderCode,
    amount: format.thb(order.totals.grossAmount),
    customer: customerName ?? "—",
  });

  // Every write re-reads the order, its group and the queues rather than trusting a partial answer.
  const settle: Settle = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order_group") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };

  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };

  switch (open) {
    case "approve_slip":
    case "reject_slip":
      // Finance's own review (D-061): the bank reference, then the group code retyped.
      return slip ? (
        <SlipReview slip={slip} onClose={onClose} initialDecision={open === "approve_slip" ? "approve" : "reject"} />
      ) : null;
    case "start_production":
      return (
        <ConfirmAction
          {...common}
          title={t("startProduction.title")}
          description={`${restated} ${t("startProduction.body")}`}
          confirmLabel={t("startProduction.confirm")}
          confirmationPhrase={order.orderCode}
          reason={{
            label: t("startProduction.reason"),
            required: true,
            minLength: 3,
            hint: t("startProduction.reasonHint"),
          }}
          onConfirm={async ({ reason }) => {
            try {
              // No Idempotency-Key: the published operation does not take one (CONTRACT-GAP admin.order-actions).
              await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/actions/start-production", {
                params: { path: { orderId } },
                body: { reason: reason! },
              });
              settle();
              toast.success(t("startProduction.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    case "cancel":
      return (
        <CancelDialog
          order={order}
          paid={(schedule.data?.instalments ?? []).some((instalment) => instalment.paidAmount !== "0.00")}
          restated={restated}
          onClose={onClose}
          settle={settle}
          fail={fail}
        />
      );
    case "send_payment_reminder":
      return (
        <ConfirmAction
          {...common}
          title={t("remind.title")}
          description={t("remind.body", {
            customer: customerName ?? "—",
            amount: format.thb(nextInstalment?.grossAmount),
          })}
          confirmLabel={t("remind.confirm")}
          onConfirm={async () => {
            try {
              await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/send-payment-reminder", {
                path: { orderId },
              });
              settle();
              toast.success(t("remind.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    case "record_slip":
      return group && schedule.data ? (
        <RecordSlipDialog
          order={order}
          group={group}
          instalments={schedule.data.instalments}
          onClose={onClose}
          settle={settle}
          fail={fail}
        />
      ) : null;
    default:
      return null;
  }
}

function CancelDialog({
  order,
  paid,
  restated,
  onClose,
  settle,
  fail,
}: {
  order: Order;
  paid: boolean;
  restated: string;
  onClose: () => void;
  settle: Settle;
  fail: (error: unknown) => never;
}) {
  const t = useTranslations("orders.actions");
  const [reasonCode, setReasonCode] = useState<string>("");
  const reasons = useQuery({
    queryKey: queryKeys.list("admin", "order_cancel_reason"),
    queryFn: () => browserRequests().call("GET /v1/admin/order-cancel-reasons"),
    staleTime: STALE_TIME.reference,
  });
  const chosen = reasons.data?.data.find((reason) => reason.code === reasonCode);

  return (
    <ConfirmAction
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("cancel.title")}
      description={`${restated} ${paid ? t("cancel.paidBody") : t("cancel.body")}`}
      confirmLabel={t("cancel.confirm")}
      tone="destructive"
      confirmationPhrase={order.orderCode}
      reason={{ label: t("cancel.note"), hint: chosen?.requiresCreditNote ? t("cancel.creditNote") : undefined }}
      onConfirm={async ({ reason }) => {
        if (!reasonCode) {
          toast.error(t("cancel.chooseReason"));
          throw new Error("no reason");
        }
        try {
          // No Idempotency-Key: the published operation does not take one (CONTRACT-GAP admin.order-actions).
          await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/actions/cancel", {
            params: { path: { orderId: order.id } },
            body: { reasonCode, ...(reason ? { note: reason } : {}) },
          });
          settle();
          toast.success(t("cancel.done"));
        } catch (error) {
          fail(error);
        }
      }}
    >
      <Field label={t("cancel.reasonCode")} required className="mt-4">
        <Select
          value={reasonCode || undefined}
          onValueChange={setReasonCode}
          placeholder={t("cancel.chooseReason")}
          options={(reasons.data?.data ?? []).map((reason) => ({ value: reason.code, label: reason.name }))}
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * CS records a slip the customer sent some other way (D-061): a bank-transfer payment is opened for
 * the chosen instalment (`admin.payments.initiate`), then the slip is uploaded to it
 * (`admin.payments.uploadSlip`) and goes through the same automatic checks as the customer's own.
 */
function RecordSlipDialog({
  order,
  group,
  instalments,
  onClose,
  settle,
  fail,
}: {
  order: Order;
  group: OrderGroup;
  instalments: { id: string; labelTh: string; labelEn: string; grossAmount: string; status: string }[];
  onClose: () => void;
  settle: Settle;
  fail: (error: unknown) => never;
}) {
  const t = useTranslations("orders.actions.recordSlip");
  const format = useFormat();
  const locale = useLocale();
  const open = instalments.filter((instalment) => !["paid", "cancelled", "refunded"].includes(instalment.status));
  const [instalmentId, setInstalmentId] = useState(open[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(open[0]?.grossAmount ?? "");
  const [transferredAt, setTransferredAt] = useState("");
  const ready = instalmentId && file && /^\d+(\.\d{1,2})?$/.test(amount) && transferredAt;

  return (
    <ConfirmAction
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      description={t("body", { code: order.orderCode })}
      confirmLabel={t("confirm")}
      onConfirm={async ({ idempotencyKey }) => {
        if (!ready) {
          toast.error(t("incomplete"));
          throw new Error("incomplete");
        }
        try {
          const uploaded = await uploadFile("admin", file, "slip");
          const [whole, fraction = ""] = amount.split(".");
          const { contract } = adminBrowserApis();
          const payment = (
            await contract.POST("/v1/admin/order-groups/{groupId}/payments", {
              params: { path: { groupId: group.id }, header: { "Idempotency-Key": `${idempotencyKey}:payment` } },
              body: { method: "bank_transfer_slip", instalmentIds: [instalmentId] },
            })
          ).data!;
          await contract.POST("/v1/admin/payments/{paymentId}/slips", {
            params: { path: { paymentId: payment.id }, header: { "Idempotency-Key": `${idempotencyKey}:slip` } },
            body: {
              fileId: uploaded.id,
              declaredAmount: `${whole}.${fraction.padEnd(2, "0")}`,
              transferredAt: `${transferredAt}:00+07:00`,
            },
          });
          settle();
          toast.success(t("done"));
        } catch (error) {
          fail(error);
        }
      }}
    >
      <div className="mt-4 space-y-3">
        <Field label={t("instalment")}>
          <Select
            value={instalmentId}
            onValueChange={setInstalmentId}
            options={open.map((instalment) => ({
              value: instalment.id,
              label: `${locale === "en" ? instalment.labelEn : instalment.labelTh} · ${format.thb(instalment.grossAmount)}`,
            }))}
          />
        </Field>
        <FileDropzone
          accept="image/*,application/pdf"
          maxBytes={10 * 1024 * 1024}
          onFiles={([picked]) => setFile(picked ?? null)}
          labels={{
            prompt: file ? t("chosen", { name: file.name }) : t("drop"),
            browse: t("browse"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
        <Field label={t("amount")} hint={t("amountHint")}>
          <NumberInput
            unit={t("baht")}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("transferredAt")} hint={t("bangkokTime")}>
          <Input
            type="datetime-local"
            value={transferredAt}
            onChange={(event) => setTransferredAt(event.target.value)}
          />
        </Field>
      </div>
    </ConfirmAction>
  );
}
