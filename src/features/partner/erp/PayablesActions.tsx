"use client";

import { useTranslations } from "next-intl";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

import { ActionBar } from "./ActionBar";

/** A supplier invoice's actions (D-337): approve a variance, pay, cancel — as the API offers them. */
export function InvoiceActions({ invoice }: { invoice: Schemas["ErpSupplierInvoiceDto"] }) {
  const t = useTranslations("partnerFactory.payables.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const format = useFormat();
  const { factoryId } = useFactory();
  const path = { factoryId, invoiceId: invoice.id };
  return (
    <ActionBar
      offered={invoice.nextActions}
      failed={tCommon("failed")}
      actions={[
        {
          key: "erp_ap.pay",
          label: tStatus("paySupplier"),
          icon: "coins",
          variant: "primary",
          href: `/payables/payments/new?supplier=${invoice.supplier.id}&invoice=${invoice.id}`,
        },
        {
          key: "erp_ap.approve",
          label: tStatus("approveSupplierInvoice"),
          icon: "check",
          variant: "primary",
          confirm: {
            title: t("approveTitle"),
            body: t("approveBody", {
              no: invoice.docNo,
              note: invoice.matchNote ?? "",
              total: format.thb(invoice.total),
            }),
            confirmLabel: t("approveConfirm"),
            phrase: invoice.docNo,
            reason: { label: t("note"), required: false, placeholder: t("notePlaceholder") },
          },
          run: ({ idempotencyKey, reason }) =>
            browserApi().POST("/v1/partner/factories/{factoryId}/erp/supplier-invoices/{invoiceId}/actions/approve", {
              params: { path, header: { "Idempotency-Key": idempotencyKey } },
              body: reason ? { note: reason } : {},
            }),
          done: t("approved"),
        },
        {
          key: "erp_ap.cancel",
          label: tStatus("cancelSupplierInvoice"),
          icon: "ban",
          variant: "destructive",
          confirm: {
            title: t("cancelTitle"),
            body: t("cancelBody", { no: invoice.docNo }),
            confirmLabel: t("cancelConfirm"),
            destructive: true,
            phrase: invoice.docNo,
            reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
          },
          run: ({ idempotencyKey, reason }) =>
            browserApi().POST("/v1/partner/factories/{factoryId}/erp/supplier-invoices/{invoiceId}/actions/cancel", {
              params: { path, header: { "Idempotency-Key": idempotencyKey } },
              body: { reason },
            }),
          done: t("cancelled"),
        },
      ]}
    />
  );
}

/** A payment's one action (D-338): reverse it — a negative payment names it and its invoices reopen. */
export function PaymentActions({ payment }: { payment: Schemas["ErpSupplierPaymentDto"] }) {
  const t = useTranslations("partnerFactory.payables.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const format = useFormat();
  const { factoryId } = useFactory();
  return (
    <ActionBar
      offered={payment.nextActions}
      failed={tCommon("failed")}
      actions={[
        {
          key: "erp_pay.reverse",
          label: tStatus("reversePayment"),
          icon: "undo",
          variant: "destructive",
          confirm: {
            title: t("reverseTitle"),
            body: t("reverseBody", { no: payment.paymentNo, amount: format.thb(payment.amount) }),
            confirmLabel: t("reverseConfirm"),
            destructive: true,
            phrase: payment.paymentNo,
            reason: { label: t("reason"), required: true, placeholder: t("reversePlaceholder") },
          },
          run: async ({ idempotencyKey, reason }) =>
            (
              await browserApi().POST(
                "/v1/partner/factories/{factoryId}/erp/supplier-payments/{paymentId}/actions/reverse",
                {
                  params: { path: { factoryId, paymentId: payment.id }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { reason },
                },
              )
            ).data,
          done: t("reversed"),
          next: (result) => {
            const id = (result as { id?: string } | undefined)?.id;
            return id ? `/payables/payments/${id}` : undefined;
          },
        },
      ]}
    />
  );
}
