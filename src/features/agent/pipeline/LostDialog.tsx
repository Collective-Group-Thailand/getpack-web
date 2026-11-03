"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

import { useProblemText } from "./problem";

type Reason = Schemas["AgentLeadLostReason"];
const REASONS: readonly Reason[] = ["price", "lead_time", "no_need", "competitor", "no_response", "other"];

/**
 * Closing a lead as lost (D-468 §1): the reason is required, a note is optional, and the agent is told plainly what
 * happens — the protection ends now and the contact can be registered again later. Final: won and lost never reopen.
 */
export function LostDialog({
  open,
  onOpenChange,
  leadId,
  name,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  name: string;
  onDone?: () => void;
}) {
  const t = useTranslations("agentSales.lost");
  const tCommon = useTranslations("common");
  const problemText = useProblemText();
  const [reason, setReason] = useState<Reason | undefined>(undefined);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return setError(t("reasonRequired"));
    setBusy(true);
    setError(null);
    try {
      await browserApi().POST("/v1/store/agent/leads/{leadId}/actions/change-stage", {
        params: { path: { leadId } },
        body: { stage: "lost", lostReason: reason, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      toast.success(t("done", { name }));
      onOpenChange(false);
      onDone?.();
    } catch (failure) {
      setError(problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={t("title", { name })}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {tCommon("actions.cancel")}
          </Button>
          <Button variant="destructive" loading={busy} onClick={() => void submit()}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("reason")} required error={error && !reason ? error : undefined}>
          <RadioCards
            columns={2}
            value={reason}
            onValueChange={(value) => {
              setReason(value);
              setError(null);
            }}
            options={REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
          />
        </Field>
        <Field label={t("note")} hint={t("noteHint")}>
          <Textarea rows={2} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error && reason ? <Callout tone="danger" title={error} live /> : null}
      </div>
    </Dialog>
  );
}
