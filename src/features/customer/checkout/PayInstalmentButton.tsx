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

/** What paying an instalment needs (`StoreInstalmentDto`): its group, what is left and a payment already started. */
export interface PayableInstalment {
  id: string;
  groupId: string;
  label: string;
  /** What is left to pay. */
  grossAmount: string;
  activePaymentId: string | null;
}

export interface PayInstalmentButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  instalment: PayableInstalment;
  orderCode: string;
  children: React.ReactNode;
  /** Inside LINE's LIFF (D-151) the payment page is LIFF's too. */
  surface?: "account" | "liff";
}

/**
 * Pays one instalment (D-020) from anywhere in the account: choose a method, then the payment
 * page. A payment already started is continued rather than duplicated. A payment starts on the
 * instalment's group (`store.payments.initiate`), which the instalment names (`groupId`).
 */
export function PayInstalmentButton({
  instalment,
  orderCode,
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
      const { data: payment } = await browserApi().POST("/v1/store/order-groups/{groupId}/payments", {
        params: { path: { groupId: instalment.groupId }, header: { "Idempotency-Key": newKey() } },
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
