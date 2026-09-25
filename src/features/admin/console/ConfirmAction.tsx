"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { newIdempotencyKey } from "@/lib/api/client";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";

export interface ConfirmActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /**
   * The consequence, restating the target: order code and amount for anything financial
   * (00-master-plan.md §8). This is the sentence that stops the wrong click.
   */
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "destructive";
  /** Irreversible: the person retypes this (an order code) before the action unlocks. */
  confirmationPhrase?: string;
  /** Ask for a reason; the API records it with the audit entry. */
  reason?: { label: string; required?: boolean; hint?: string };
  /**
   * Called with an `Idempotency-Key` minted once when the dialog opened — so a retry after a
   * timeout replays the same request instead of repeating the act (api-conventions §3).
   */
  onConfirm: (input: { idempotencyKey: string; reason: string }) => Promise<void> | void;
  children?: React.ReactNode;
}

/**
 * Every irreversible or consequential back-office action goes through here: restated target,
 * optional typed confirmation, optional reason, and one idempotency key per intent.
 */
export function ConfirmAction(props: ConfirmActionProps) {
  // Mounted only while open, so each opening is a new intent with a new key and an empty reason.
  return props.open ? <ConfirmActionBody {...props} /> : null;
}

function ConfirmActionBody({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  confirmationPhrase,
  reason,
  onConfirm,
  children,
}: ConfirmActionProps) {
  const t = useTranslations("console.confirm");
  const tCommon = useTranslations("common");
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [missingReason, setMissingReason] = useState(false);

  async function confirm() {
    if (reason?.required && !text.trim()) {
      setMissingReason(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ idempotencyKey, reason: text.trim() });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={tCommon("actions.cancel")}
      onConfirm={() => void confirm()}
      tone={tone}
      loading={busy}
      confirmationPhrase={confirmationPhrase}
      confirmationLabel={confirmationPhrase ? t("typeToConfirm", { phrase: confirmationPhrase }) : undefined}
    >
      {children}
      {reason ? (
        <Field
          label={reason.label}
          hint={reason.hint}
          required={reason.required}
          requiredLabel={tCommon("state.required")}
          error={missingReason ? t("reasonRequired") : undefined}
          className="mt-4"
        >
          <Textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setMissingReason(false);
            }}
            rows={3}
          />
        </Field>
      ) : null}
    </AlertDialog>
  );
}
