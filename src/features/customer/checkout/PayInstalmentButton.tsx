"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ONLINE_PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment-methods";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

export interface PayInstalmentButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  instalment: { id: string; label: string; grossAmount: string; activePaymentId: string | null };
  orderCode: string;
  /** The order group the instalment belongs to, when the caller knows it. */
  groupId?: string | null;
  children: React.ReactNode;
  /** Inside LINE's LIFF (D-151) the payment page is LIFF's too. */
  surface?: "account" | "liff";
}

/**
 * The order group an order belongs to, found from its code (`store.orders.listGroups?q=`).
 *
 * CONTRACT-GAP store.order-group-ref — a payment starts on the group (`store.payments.initiate`) but
 * `OrderDto` does not say which group it is in, so a screen that knows only the order looks the
 * group up by the order's code and checks the group really holds it.
 */
async function groupOf(orderCode: string): Promise<string | null> {
  const { data } = await browserApi().GET("/v1/store/order-groups", { params: { query: { q: orderCode } } });
  return data?.data.find((group) => group.orders.some((order) => order.orderCode === orderCode))?.id ?? null;
}

/**
 * Pays one instalment (D-020) from anywhere in the account: choose a method, then the payment
 * page. A payment already started is continued rather than duplicated.
 */
export function PayInstalmentButton({
  instalment,
  orderCode,
  groupId,
  children,
  surface = "account",
  ...button
}: PayInstalmentButtonProps) {
  const t = useTranslations("instalments");
  const tMethods = useTranslations("checkout.methods");
  const format = useFormat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("scb_qr");
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      if (instalment.activePaymentId) {
        router.push(`${surface === "liff" ? "/liff/pay" : "/checkout/pay"}/${instalment.activePaymentId}`);
        return;
      }
      const group = groupId ?? (await groupOf(orderCode));
      if (!group) throw new Error("group.unknown");
      const { data: payment } = await browserApi().POST("/v1/store/order-groups/{groupId}/payments", {
        params: { path: { groupId: group }, header: { "Idempotency-Key": newKey() } },
        body: { method, instalmentIds: [instalment.id] },
      });
      router.push(`${surface === "liff" ? "/liff/pay" : "/checkout/pay"}/${payment!.id}`);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  }

  return (
    <>
      <Button {...button} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("payTitle", { code: orderCode, amount: format.thb(instalment.grossAmount) })}
        description={instalment.label}
        closeLabel={t("close")}
      >
        {instalment.activePaymentId ? (
          <p className="text-sm">{t("continueBody")}</p>
        ) : (
          <RadioCards
            aria-label={t("method")}
            columns={2}
            value={method}
            onValueChange={(value) => setMethod(value as PaymentMethod)}
            options={ONLINE_PAYMENT_METHODS.map((value) => ({
              value,
              label: tMethods(`${value}.label`),
              description: tMethods(`${value}.description`),
            }))}
          />
        )}
        <div className="mt-4 flex justify-end">
          <Button loading={busy} onClick={() => void pay()}>
            {t("payNow")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
