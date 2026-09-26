"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

type Method = "scb_qr" | "card_2c2p" | "online_banking_2c2p" | "bank_transfer_slip";
const METHODS: Method[] = ["scb_qr", "card_2c2p", "online_banking_2c2p", "bank_transfer_slip"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

export interface PayInstalmentButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  instalment: { id: string; label: string; grossAmount: string; activePaymentId: string | null };
  orderCode: string;
  children: React.ReactNode;
}

/**
 * Pays one instalment (D-020) from anywhere in the account: choose a method, then the payment
 * page. A payment already started is continued rather than duplicated.
 */
export function PayInstalmentButton({ instalment, orderCode, children, ...button }: PayInstalmentButtonProps) {
  const t = useTranslations("instalments");
  const tMethods = useTranslations("checkout.methods");
  const format = useFormat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>("scb_qr");
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      if (instalment.activePaymentId) {
        router.push(`/checkout/pay/${instalment.activePaymentId}`);
        return;
      }
      const base = window.location.pathname.replace(/\/(account|checkout).*$/, "");
      const payment = await browserRequests().call("POST /v1/store/instalments/{instalmentId}/payments", {
        path: { instalmentId: instalment.id },
        body: { method, returnUrl: `${window.location.origin}${base}/checkout/return` },
        idempotencyKey: newKey(),
      });
      router.push(`/checkout/pay/${payment.id}`);
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
            onValueChange={(value) => setMethod(value as Method)}
            options={METHODS.map((value) => ({
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
