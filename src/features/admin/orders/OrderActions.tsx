"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, NextActionBar, problemMessage } from "../console";
import { SlipReview } from "../finance/slips";
import { useGroupSchedule, type QueuedSlip } from "./data";
import { RepriceOrderDialog } from "./OrderExtras";
import type { CancelReason, Order, OrderGroup } from "./resources";

/**
 * What the order screen can open: the order's own actions (`nextActions`) and the group's payment
 * operations, which packio-api offers no action list for (no order-group actions, U-B0.3) — the
 * Payments tab opens those from the instalment and the slip they act on.
 */
export type OrderActionKey =
  "approve_slip" | "reject_slip" | "start_production" | "cancel" | "send_payment_reminder" | "record_slip" | "reprice";

/**
 * The order actions this screen performs. packio-api also offers `submit_artwork` (the prepress
 * desk's) and `add_mockup` (deprecated by D-254 — a sample is ordered from the samples desk); they
 * show disabled with why.
 */
const SUPPORTED = new Set<string>(["start_production", "cancel", "reprice"]);

/** The order's actions exactly as the API offered them (`AdminOrderDto.nextActions`) — see `NextActionBar`. */
export function OrderActionBar({
  actions,
  onAction,
}: {
  actions: Order["nextActions"];
  onAction: (key: OrderActionKey) => void;
}) {
  const t = useTranslations("orders.actions");
  const tProblems = useTranslations("problems");
  return (
    <NextActionBar
      // A blocked action's reason is a message key (`order.reprice_has_discounts`): the problem
      // copy when this app has words for it, else as the API gave it.
      actions={actions.map((action) => ({
        ...action,
        disabledReason:
          action.disabledReason && tProblems.has(action.disabledReason)
            ? tProblems(action.disabledReason)
            : action.disabledReason,
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
  open,
  slip,
  onClose,
}: {
  order: Order;
  group: OrderGroup | null;
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
  const customerName = group?.customer.displayName ?? null;
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
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/actions/start-production", {
                params: { path: { orderId }, header: { "Idempotency-Key": idempotencyKey } },
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
            amount: format.thb(nextInstalment?.openAmount),
          })}
          confirmLabel={t("remind.confirm")}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              // packio-api reminds of the group's first unpaid due instalment, once an hour at most.
              await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/actions/send-payment-reminder", {
                params: { path: { orderId }, header: { "Idempotency-Key": idempotencyKey } },
              });
              settle();
              toast.success(t("remind.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    case "reprice":
      return <RepriceOrderDialog order={order} group={group} onClose={onClose} />;
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
  const locale = useLocale();
  const [reasonCode, setReasonCode] = useState<string>("");
  // The reasons staff may give (D-060); the customer's and the system's own are not offered here.
  const reasons = useQuery({
    queryKey: queryKeys.list("admin", "order_cancel_reason", { appliesTo: "staff" }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/order-cancel-reasons", {
          params: { query: { appliesTo: "staff" } },
        })
      ).data!,
    staleTime: STALE_TIME.reference,
  });
  const nameOf = (reason: CancelReason) => (locale === "en" ? reason.nameEn : reason.nameTh);
  const chosen = reasons.data?.find((reason) => reason.code === reasonCode);

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
          await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/actions/cancel", {
            params: { path: { orderId: order.id }, header: { "Idempotency-Key": idempotencyKey } },
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
        <SearchableSelect
          value={reasonCode || undefined}
          onValueChange={setReasonCode}
          placeholder={t("cancel.chooseReason")}
          options={(reasons.data ?? []).map((reason) => ({ value: reason.code, label: nameOf(reason) }))}
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
  // Two writes, one intent: the payment takes the dialog's key, the slip its own (each a uuid).
  const [slipKey] = useState(newIdempotencyKey);
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
              params: { path: { groupId: group.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { method: "bank_transfer_slip", instalmentIds: [instalmentId] },
            })
          ).data!;
          await contract.POST("/v1/admin/payments/{paymentId}/slips", {
            params: { path: { paymentId: payment.id }, header: { "Idempotency-Key": slipKey } },
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
          <SearchableSelect
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
