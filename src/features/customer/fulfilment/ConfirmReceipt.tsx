"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserApi } from "@/lib/api/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Confirming receipt (D-081): the dialog restates the order and what confirming means — the order
 * completes, and a problem can still be reported until the claim window the API gives ends (D-082).
 * One key per intent.
 */
export function ConfirmReceipt({
  orderId,
  orderCode,
  claimWindowEndsAt,
}: {
  orderId: string;
  orderCode: string;
  claimWindowEndsAt: string | null;
}) {
  const t = useTranslations("fulfilment.receipt");
  const format = useFormat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function confirm() {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/orders/{orderId}/actions/confirm-receipt", {
        params: { path: { orderId }, header: { "Idempotency-Key": key.current } },
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
        description={
          claimWindowEndsAt ? t("confirmBody", { date: format.dateTime(claimWindowEndsAt) }) : t("confirmBodyNoDate")
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        loading={busy}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
