"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";

export const SAMPLE_CHECKS = ["dimensions", "colour", "material", "construction"] as const;
export type SampleCheck = (typeof SAMPLE_CHECKS)[number];
export type SampleDecisionKind = "approve" | "request-changes" | "reject";

/**
 * Deciding on a delivered sample (U2.F3, D-255): approve only once every point of the checklist is
 * ticked — dimensions, colour, material, construction — or ask for changes / reject with a note.
 * Presentational: the caller sends the decision (and keeps this testable on its own).
 */
export function SampleDecision({
  busy,
  onDecide,
}: {
  busy: SampleDecisionKind | null;
  onDecide: (kind: SampleDecisionKind, input: { checked: SampleCheck[]; note: string }) => void;
}) {
  const t = useTranslations("myOrders.samples.detail");
  const [checked, setChecked] = useState<SampleCheck[]>([]);
  const [note, setNote] = useState("");
  const complete = checked.length === SAMPLE_CHECKS.length;
  const decide = (kind: SampleDecisionKind) => onDecide(kind, { checked, note: note.trim() });

  return (
    <section aria-labelledby="sample-decide" className="border-border flex flex-col gap-4 rounded-xl border p-4">
      <h2 id="sample-decide" className="text-lg font-semibold">
        {t("decideTitle")}
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("checklist")}</legend>
        {SAMPLE_CHECKS.map((c) => (
          <Checkbox
            key={c}
            label={t(`checks.${c}`)}
            description={t(`checkHints.${c}`)}
            checked={checked.includes(c)}
            onCheckedChange={(on) => setChecked((list) => (on ? [...list, c] : list.filter((x) => x !== c)))}
          />
        ))}
      </fieldset>
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button loading={busy === "approve"} disabled={!complete} onClick={() => decide("approve")}>
          {t("approve")}
        </Button>
        <Button
          variant="secondary"
          loading={busy === "request-changes"}
          disabled={!note.trim()}
          onClick={() => decide("request-changes")}
        >
          {t("requestChanges")}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          loading={busy === "reject"}
          disabled={!note.trim()}
          onClick={() => decide("reject")}
        >
          {t("reject")}
        </Button>
      </div>
      <p className="text-muted text-xs">{complete ? t("approveHint") : t("checklistHint")}</p>
    </section>
  );
}
