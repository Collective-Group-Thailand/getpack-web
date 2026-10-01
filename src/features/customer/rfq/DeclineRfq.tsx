"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * The customer closes their own request (`store.rfqs.decline`, D-102), offered while the RFQ
 * carries `rfq.decline`. It cannot be undone, so the dialog restates the RFQ and asks for its code
 * to be typed; the note is optional. The operation declares no Idempotency-Key.
 */
export function DeclineRfq({ rfqId, rfqCode }: { rfqId: string; rfqCode: string }) {
  const t = useTranslations("quoteRequests.decline");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decline() {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/rfqs/{rfqId}/actions/decline", {
        params: { path: { rfqId } },
        body: note.trim() ? { note: note.trim() } : {},
      });
      setOpen(false);
      toast.success(t("done", { code: rfqCode }));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" iconStart="ban" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { code: rfqCode })}
        description={t("body", { code: rfqCode })}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="destructive"
        loading={busy}
        confirmationPhrase={rfqCode}
        confirmationLabel={t("typeCode", { code: rfqCode })}
        onConfirm={() => void decline()}
      >
        <Field label={t("note")}>
          <Textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </AlertDialog>
    </>
  );
}
