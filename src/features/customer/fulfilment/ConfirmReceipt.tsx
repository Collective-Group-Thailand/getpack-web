"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Confirming receipt (D-081): the dialog restates the order and what confirming means — the order
 * completes and the 7-day claim window (D-082) runs from now. One key per intent.
 */
export function ConfirmReceipt({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const t = useTranslations("fulfilment.receipt");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function confirm() {
    setBusy(true);
    try {
      await browserRequests().call("POST /v1/store/orders/{orderId}/actions/confirm-receipt", {
        path: { orderId },
        body: {},
        idempotencyKey: key.current,
      });
      setOpen(false);
      toast.success(t("done"));
      router.refresh();
    } catch (error) {
      key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button iconStart="package-check" onClick={() => setOpen(true)}>
        {t("confirm")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle", { code: orderCode })}
        description={t("confirmBody")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        loading={busy}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
