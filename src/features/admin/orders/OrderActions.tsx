"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { nextActionMeta, primaryAction, type NextAction } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";
import { Tooltip } from "@/ui/components/Tooltip";

import { ConfirmAction, problemMessage } from "../console";
import type { Order } from "./resources";

type Slip = Order["payments"][number]["slips"][number];
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
const verb = (key: string) => key.slice(key.lastIndexOf(".") + 1);

/**
 * The order's actions, exactly as the API offered them (`nextActions`, ADR-0005): the first
 * unblocked one leads (design-system.md §4 "the single next best action"), the rest sit behind
 * "more", and a blocked one says why. An action key this version cannot perform is shown
 * disabled rather than hidden, so a new backend capability is visible, not lost.
 */
export function OrderActionBar({
  order,
  onAction,
}: {
  order: Order;
  onAction: (key: OrderActionKey, slip?: Slip) => void;
}) {
  const t = useTranslations("status");
  const tOrders = useTranslations("orders.actions");
  const lead = primaryAction(order.nextActions);
  const rest = order.nextActions.filter((action) => action !== lead);

  const label = (action: NextAction) => {
    const key = verb(action.key);
    return tOrders.has(`labels.${key}`) ? tOrders(`labels.${key}`) : t(nextActionMeta(action.key).labelKey);
  };

  const run = (action: NextAction) => {
    const key = verb(action.key);
    if (SUPPORTED.has(key)) onAction(key as OrderActionKey);
  };

  if (order.nextActions.length === 0) return null;

  return (
    <>
      {rest.length > 0 ? (
        <DropdownMenu
          label={tOrders("more")}
          align="end"
          items={rest.map((action) => ({
            id: action.key,
            label: label(action),
            description:
              action.disabledReason ?? (SUPPORTED.has(verb(action.key)) ? undefined : tOrders("unsupported")),
            icon: nextActionMeta(action.key).icon,
            tone: nextActionMeta(action.key).tone === "danger" ? "destructive" : "default",
            disabled: Boolean(action.disabledReason) || !SUPPORTED.has(verb(action.key)),
            onSelect: () => run(action),
          }))}
          trigger={
            <Button variant="secondary" iconEnd="chevron-down">
              {tOrders("more")}
            </Button>
          }
        />
      ) : null}
      {lead ? (
        lead.disabledReason ? (
          <Tooltip content={lead.disabledReason}>
            <span tabIndex={0}>
              <Button disabled iconStart={nextActionMeta(lead.key).icon}>
                {label(lead)}
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            iconStart={nextActionMeta(lead.key).icon}
            variant={nextActionMeta(lead.key).tone === "danger" ? "destructive" : "primary"}
            onClick={() => run(lead)}
          >
            {label(lead)}
          </Button>
        )
      ) : null}
    </>
  );
}

/** The dialog for whichever action is open. One component so every action shares the same rules. */
export function OrderActionDialogs({
  order,
  open,
  slip,
  onClose,
}: {
  order: Order;
  open: OrderActionKey | null;
  slip: Slip | null;
  onClose: () => void;
}) {
  const t = useTranslations("orders.actions");
  const format = useFormat();
  const queryClient = useQueryClient();
  const orderId = order.id;
  const reviewable =
    slip ??
    order.payments.flatMap((payment) => payment.slips).find((item) => item.verificationStatus === "manual_review") ??
    null;
  const restated = t("restate", {
    code: order.orderCode,
    amount: format.thb(order.grossAmount),
    customer: order.customer.displayName,
  });

  const settle = (updated: Order | void) => {
    if (updated) queryClient.setQueryData(queryKeys.detail("admin", "order", orderId), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };

  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };

  switch (open) {
    case "approve_slip":
      return reviewable ? (
        <ConfirmAction
          {...common}
          title={t("approveSlip.title")}
          description={t("approveSlip.body", { code: order.orderCode, amount: format.thb(reviewable.declaredAmount) })}
          confirmLabel={t("approveSlip.confirm")}
          confirmationPhrase={order.orderCode}
          reason={{ label: t("approveSlip.note"), hint: t("approveSlip.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              settle(
                await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/approve-slip", {
                  path: { orderId },
                  body: { slipId: reviewable.id, ...(reason ? { note: reason } : {}) },
                  idempotencyKey,
                }),
              );
              toast.success(t("approveSlip.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      ) : null;
    case "reject_slip":
      return reviewable ? (
        <ConfirmAction
          {...common}
          title={t("rejectSlip.title")}
          description={t("rejectSlip.body", { code: order.orderCode })}
          confirmLabel={t("rejectSlip.confirm")}
          tone="destructive"
          reason={{ label: t("rejectSlip.reason"), required: true, minLength: 3, hint: t("rejectSlip.reasonHint") }}
          onConfirm={async ({ reason }) => {
            try {
              settle(
                await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/reject-slip", {
                  path: { orderId },
                  body: { slipId: reviewable.id, reason },
                }),
              );
              toast.success(t("rejectSlip.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
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
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              settle(
                await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/start-production", {
                  path: { orderId },
                  body: { reason },
                  idempotencyKey,
                }),
              );
              toast.success(t("startProduction.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    case "cancel":
      return <CancelDialog order={order} restated={restated} onClose={onClose} settle={settle} fail={fail} />;
    case "send_payment_reminder":
      return (
        <ConfirmAction
          {...common}
          title={t("remind.title")}
          description={t("remind.body", {
            customer: order.customer.displayName,
            amount: format.thb(order.nextInstalment?.grossAmount),
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
      return <RecordSlipDialog order={order} onClose={onClose} settle={settle} fail={fail} />;
    default:
      return null;
  }
}

function CancelDialog({
  order,
  restated,
  onClose,
  settle,
  fail,
}: {
  order: Order;
  restated: string;
  onClose: () => void;
  settle: (order: Order) => void;
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
  const paid = order.instalments.some((instalment) => instalment.paidAmount !== "0.00");

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
      onConfirm={async ({ idempotencyKey, reason }) => {
        if (!reasonCode) {
          toast.error(t("cancel.chooseReason"));
          throw new Error("no reason");
        }
        try {
          settle(
            await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/cancel", {
              path: { orderId: order.id },
              body: { reasonCode, ...(reason ? { note: reason } : {}) },
              idempotencyKey,
            }),
          );
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

function RecordSlipDialog({
  order,
  onClose,
  settle,
  fail,
}: {
  order: Order;
  onClose: () => void;
  settle: (order: Order) => void;
  fail: (error: unknown) => never;
}) {
  const t = useTranslations("orders.actions.recordSlip");
  const format = useFormat();
  const open = order.instalments.filter(
    (instalment) => instalment.status !== "paid" && instalment.status !== "cancelled",
  );
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
          settle(
            await browserRequests().call("POST /v1/admin/orders/{orderId}/actions/record-slip", {
              path: { orderId: order.id },
              body: {
                instalmentId,
                fileId: uploaded.id,
                declaredAmount: `${whole}.${fraction.padEnd(2, "0")}`,
                declaredTransferredAt: `${transferredAt}:00+07:00`,
              },
              idempotencyKey,
            }),
          );
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
              label: `${instalment.label} · ${format.thb(instalment.grossAmount)}`,
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
