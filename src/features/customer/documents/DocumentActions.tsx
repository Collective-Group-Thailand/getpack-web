"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

type Reason = Schemas["DocumentCorrectionReason"];
type Party = Schemas["DocumentPartyDto"];

const REASONS = ["buyer_name", "buyer_address", "buyer_tax_id", "other"] as const satisfies readonly Reason[];

/**
 * The copy of a cancelled document stamped "ยกเลิก" (D-431): the buyer keeps it with the replacement. Asked for on
 * click, opened by a second click — a tab opened after an await is a pop-up to the browser.
 */
export function CancelledCopyLink({ documentId, number }: { documentId: string; number: string }) {
  const t = useTranslations("account.documents");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url)
    return (
      <Button asChild size="sm" variant="ghost" iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t("openCancelled")}
          <span className="sr-only"> {number}</span>
        </a>
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="ghost"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/documents/{documentId}/cancelled-pdf", {
            params: { path: { documentId } },
          });
          setUrl(data!.url);
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("downloadFailed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("cancelledCopy")}
      <span className="sr-only"> {number}</span>
    </Button>
  );
}

/**
 * Asking getpack to correct the buyer on a tax invoice (D-431, ป.86/2542 ข้อ 25): the customer says what is wrong
 * and gives the right name, tax id, branch and address; Finance checks it, then cancels the invoice and issues a
 * replacement under a new number with the same date. A full-form tax invoice only — no abbreviated one (D-432).
 */
export function RequestCorrection({ documentId, number, buyer }: { documentId: string; number: string; buyer: Party }) {
  const t = useTranslations("account.documents.correction");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("buyer_name");
  const [form, setForm] = useState({
    name: buyer.name,
    taxId: buyer.taxId ?? "",
    branchCode: buyer.branchCode ?? "00000",
    address: buyer.address ?? "",
    documentEmail: "",
    note: "",
  });
  const [key] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((value) => ({ ...value, [field]: event.target.value }));

  const taxIdOk = /^\d{13}$/.test(form.taxId.trim());
  const branchOk = /^\d{5}$/.test(form.branchCode.trim());
  const ready =
    form.name.trim() && taxIdOk && branchOk && form.address.trim() && (reason !== "other" || form.note.trim());

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await browserApi().POST("/v1/store/documents/{documentId}/corrections", {
        params: { path: { documentId }, header: { "Idempotency-Key": key } },
        body: {
          reason,
          buyer: {
            name: form.name.trim(),
            taxId: form.taxId.trim(),
            branchCode: form.branchCode.trim(),
            address: form.address.trim(),
            ...(form.documentEmail.trim() ? { documentEmail: form.documentEmail.trim() } : {}),
          },
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
      });
      toast.success(t("sent", { no: number }));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" iconStart="edit" onClick={() => setOpen(true)}>
        {t("open")}
        <span className="sr-only"> {number}</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !next && !busy && setOpen(false)}
        title={t("title", { no: number })}
        description={t("body")}
        closeLabel={tCommon("actions.close")}
        footer={
          <Button loading={busy} disabled={!ready} onClick={() => void send()}>
            {t("send")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("reason")}>
            <SearchableSelect
              value={reason}
              onValueChange={setReason}
              options={REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
            />
          </Field>
          <Field label={t("name")} required>
            <Input value={form.name} maxLength={200} onChange={set("name")} autoComplete="organization" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("taxId")} required error={form.taxId && !taxIdOk ? t("taxIdInvalid") : undefined}>
              <Input inputMode="numeric" maxLength={13} value={form.taxId} onChange={set("taxId")} />
            </Field>
            <Field
              label={t("branchCode")}
              hint={t("branchHint")}
              required
              error={form.branchCode && !branchOk ? t("branchInvalid") : undefined}
            >
              <Input inputMode="numeric" maxLength={5} value={form.branchCode} onChange={set("branchCode")} />
            </Field>
          </div>
          <Field label={t("address")} required>
            <Textarea value={form.address} rows={3} maxLength={500} onChange={set("address")} />
          </Field>
          <Field label={t("documentEmail")} hint={t("documentEmailHint")}>
            <Input type="email" value={form.documentEmail} maxLength={200} onChange={set("documentEmail")} />
          </Field>
          <Field label={t("note")} required={reason === "other"}>
            <Textarea value={form.note} rows={2} maxLength={1000} onChange={set("note")} />
          </Field>
          <Callout tone="neutral" title={t("howTitle")}>
            {t("how")}
          </Callout>
          {problem ? <Callout tone="danger" title={problem} /> : null}
        </div>
      </Dialog>
    </>
  );
}

/** Withdrawing a correction request still waiting for Finance (D-431). */
export function WithdrawCorrection({ requestId, number }: { requestId: string; number: string }) {
  const t = useTranslations("account.documents.correction");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      iconStart="close"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await browserApi().POST("/v1/store/documents/corrections/{requestId}/withdraw", {
            params: { path: { requestId } },
          });
          toast.success(t("withdrawn"));
          router.refresh();
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("withdraw")}
      <span className="sr-only"> {number}</span>
    </Button>
  );
}
