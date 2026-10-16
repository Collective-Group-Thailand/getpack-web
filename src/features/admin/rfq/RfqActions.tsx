"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, AssignDialog, ConfirmAction, NextActionBar, problemMessage } from "../console";
import { useCandidateFactories, useSettleRfq, useUnmetDemandReasons } from "./data";
import { draftOf, sentOf, type Rfq } from "./resources";

/** The verbs of getpack-api's RFQ actions (`rfq.<verb>`) this screen performs. */
export type RfqActionKey =
  | "start_review"
  | "assign"
  | "request_info"
  | "request_factory_cost"
  | "compose_quote"
  | "send_quote"
  | "record_acceptance"
  | "decline";

const SUPPORTED = new Set<string>([
  "start_review",
  "assign",
  "request_info",
  "request_factory_cost",
  "compose_quote",
  "send_quote",
  "record_acceptance",
  "decline",
]);

const CHANNELS: readonly Schemas["RfqAcceptanceChannel"][] = ["phone", "line", "email", "other"];

/**
 * A `disabledReason` is a message key from the API (a problem code such as `rfq.quote_empty`):
 * this app's words for it when it has them, the key itself otherwise.
 */
export function useDisabledReason() {
  const t = useTranslations("problems");
  return (reason: string | null | undefined) => (reason ? (t.has(reason) ? t(reason) : reason) : null);
}

/** The RFQ's own `nextActions`, as the API offered them — see `NextActionBar`. */
export function RfqActionBar({ rfq, onAction }: { rfq: Rfq; onAction: (key: RfqActionKey) => void }) {
  const t = useTranslations("rfq.actions");
  const reasonOf = useDisabledReason();
  return (
    <NextActionBar
      actions={rfq.nextActions.map((action) => ({ ...action, disabledReason: reasonOf(action.disabledReason) }))}
      supported={SUPPORTED}
      labelOf={(key) => (t.has(`labels.${key}`) ? t(`labels.${key}`) : undefined)}
      onAction={(key) => onAction(key as RfqActionKey)}
    />
  );
}

/** The dialog for whichever action is open. One component so every action shares the same rules. */
export function RfqActionDialogs({ rfq, open, onClose }: { rfq: Rfq; open: RfqActionKey | null; onClose: () => void }) {
  const t = useTranslations("rfq.actions");
  const format = useFormat();
  const settle = useSettleRfq(rfq.id);
  const rfqId = rfq.id;
  const draft = draftOf(rfq);
  const sent = sentOf(rfq);
  const [reasonCode, setReasonCode] = useState("");
  const [via, setVia] = useState<Schemas["RfqAcceptanceChannel"] | "">("");
  const [quantities, setQuantities] = useState<number[] | null>(null);
  const reasons = useUnmetDemandReasons(open === "decline");

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };
  const { contract } = adminBrowserApis();

  switch (open) {
    case "assign":
      return (
        <AssignDialog
          title={t("assign.title")}
          description={t("assign.body", { code: rfq.rfqCode })}
          current={rfq.assignedTo}
          permission="rfqs.manage"
          personHint={t("assign.personHint")}
          // `admin.rfqs.assign` with `userId: null` puts the request back with nobody on it.
          onAssign={async (userId) => {
            const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/actions/assign", {
              params: { path: { rfqId } },
              body: { userId },
            });
            settle(data);
          }}
          onClose={onClose}
        />
      );
    case "request_factory_cost":
      return <ConsultDialog rfq={rfq} onClose={onClose} />;
    case "request_info":
      return (
        <ConfirmAction
          {...common}
          title={t("requestInfo.title")}
          description={t("requestInfo.body", { code: rfq.rfqCode, customer: rfq.customer.displayName })}
          confirmLabel={t("requestInfo.confirm")}
          reason={{ label: t("requestInfo.message"), required: true, minLength: 3, hint: t("requestInfo.hint") }}
          onConfirm={async ({ reason }) => {
            try {
              const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/actions/request-info", {
                params: { path: { rfqId } },
                body: { body: reason },
              });
              settle(data);
              toast.success(t("requestInfo.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    case "decline":
      return (
        <ConfirmAction
          {...common}
          title={t("decline.title")}
          description={t("decline.body", { code: rfq.rfqCode, customer: rfq.customer.displayName })}
          confirmLabel={t("decline.confirm")}
          tone="destructive"
          confirmationPhrase={rfq.rfqCode}
          reason={{ label: t("decline.note"), hint: t("decline.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            if (!reasonCode) {
              toast.error(t("decline.needReason"));
              throw new Error("reason code required");
            }
            try {
              const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/actions/decline", {
                params: { path: { rfqId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reasonCode, ...(reason ? { note: reason } : {}) },
              });
              settle(data);
              toast.success(t("decline.done"));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <Field label={t("decline.reason")} hint={t("decline.reasonHint")} required>
            <SearchableSelect
              value={reasonCode || undefined}
              onValueChange={setReasonCode}
              placeholder={t("decline.choose")}
              options={reasons.reasons.map((reason) => ({ value: reason.code, label: reasons.nameOf(reason.code) }))}
            />
          </Field>
        </ConfirmAction>
      );
    case "send_quote":
      return draft ? (
        <ConfirmAction
          {...common}
          title={t("send.title", { version: draft.versionNo })}
          description={
            <>
              <span className="block">{t("send.body", { code: rfq.rfqCode, customer: rfq.customer.displayName })}</span>
              <span className="mt-2 block">
                {draft.lines.map((line) => (
                  <span key={line.quantity} className="flex justify-between gap-4 tabular-nums">
                    <span>{t("send.line", { quantity: format.number(line.quantity) })}</span>
                    <span className="font-medium">{format.thb(line.grossAmount)}</span>
                  </span>
                ))}
              </span>
              {sent ? (
                <span className="text-muted mt-2 block">{t("send.supersedes", { version: sent.versionNo })}</span>
              ) : null}
            </>
          }
          confirmLabel={t("send.confirm")}
          confirmationPhrase={rfq.rfqCode}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              // The API sets the validity when the version is sent (D-051).
              const { data } = await contract.POST("/v1/admin/rfq-quotations/{rfqQuoteId}/actions/send", {
                params: { path: { rfqQuoteId: draft.id }, header: { "Idempotency-Key": idempotencyKey } },
              });
              settle(data);
              toast.success(t("send.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      ) : null;
    case "record_acceptance": {
      if (!sent) return null;
      const chosen = quantities ?? sent.lines.map((line) => line.quantity);
      return (
        <ConfirmAction
          {...common}
          title={t("accept.title", { version: sent.versionNo })}
          description={t("accept.body", { code: rfq.rfqCode, customer: rfq.customer.displayName })}
          confirmLabel={t("accept.confirm")}
          confirmationPhrase={rfq.rfqCode}
          reason={{ label: t("accept.note"), hint: t("accept.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            if (!via) {
              toast.error(t("accept.needVia"));
              throw new Error("channel required");
            }
            if (chosen.length === 0) {
              toast.error(t("accept.needQuantity"));
              throw new Error("quantity required");
            }
            try {
              const { data } = await contract.POST("/v1/admin/rfq-quotations/{rfqQuoteId}/actions/record-acceptance", {
                params: { path: { rfqQuoteId: sent.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: {
                  via,
                  // The API reads an omitted list as every quoted quantity.
                  ...(chosen.length < sent.lines.length ? { quantities: chosen } : {}),
                  ...(reason ? { note: reason } : {}),
                },
              });
              settle(data);
              toast.success(t("accept.done"));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <Field label={t("accept.via")} required>
            <SearchableSelect
              value={via || undefined}
              onValueChange={(value) => setVia(value as Schemas["RfqAcceptanceChannel"])}
              placeholder={t("accept.chooseVia")}
              options={CHANNELS.map((value) => ({ value, label: t(`accept.channels.${value}`) }))}
            />
          </Field>
          <fieldset className="mt-3 space-y-2">
            <legend className="mb-1 text-sm font-medium">{t("accept.quantities")}</legend>
            {sent.lines.map((line) => (
              <Checkbox
                key={line.quantity}
                label={t("accept.option", {
                  quantity: format.number(line.quantity),
                  amount: format.thb(line.grossAmount),
                })}
                checked={chosen.includes(line.quantity)}
                onCheckedChange={(checked) =>
                  setQuantities(
                    checked
                      ? [...chosen, line.quantity].sort((a, b) => a - b)
                      : chosen.filter((quantity) => quantity !== line.quantity),
                  )
                }
              />
            ))}
          </fieldset>
        </ConfirmAction>
      );
    }
    default:
      return null;
  }
}

/**
 * "Request cost from factory" (F2 2.3): the factories the API says could make this category
 * (`admin.rfqs.listCandidateFactories`), with their D-043 tier and on-time rate; one whose
 * capability does not cover the quantities says why and cannot be picked.
 *
 * `admin.rfqs.requestConsultation` asks one factory per call, so the dialog asks each chosen
 * factory in turn, each with its own Idempotency-Key kept for the life of the dialog — a retry
 * after a failure replays the factories already asked instead of asking them twice. A failure
 * stops the run; the RFQ the last call answered shows the factories already asked.
 */
function ConsultDialog({ rfq, onClose }: { rfq: Rfq; onClose: () => void }) {
  const t = useTranslations("rfq.actions.consult");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const settle = useSettleRfq(rfq.id);
  const [chosen, setChosen] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const [keys] = useState(() => new Map<string, string>());
  const candidates = useCandidateFactories(rfq.id);

  const request = useMutation({
    mutationFn: async () => {
      const { contract } = adminBrowserApis();
      let latest: Rfq | undefined;
      let asked = 0;
      try {
        for (const factoryId of chosen) {
          if (!keys.has(factoryId)) keys.set(factoryId, newIdempotencyKey());
          const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/consultations", {
            params: { path: { rfqId: rfq.id }, header: { "Idempotency-Key": keys.get(factoryId)! } },
            body: { factoryId, dueAt: `${dueAt}:00+07:00`, ...(note.trim() ? { note: note.trim() } : {}) },
          });
          latest = data;
          asked += 1;
        }
      } finally {
        if (asked > 0) settle(latest);
      }
      return asked;
    },
    onSuccess: (asked) => {
      toast.success(t("done", { count: asked }));
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const submit = () => {
    if (chosen.length === 0 || !dueAt) {
      setMissing(true);
      return;
    }
    request.mutate();
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      description={t("body", { code: rfq.rfqCode, type: rfq.productTypeName })}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button iconStart="send" loading={request.isPending} onClick={submit}>
            {t("confirm", { count: chosen.length })}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("factories")}</legend>
        {candidates.isPending ? <p className="text-muted text-sm">{tCommon("state.loading")}</p> : null}
        {candidates.isError ? (
          <p className="text-danger text-sm">{problemMessage(candidates.error, t("candidatesFailed"))}</p>
        ) : null}
        {candidates.data && candidates.data.length === 0 ? (
          <p className="text-muted text-sm">{t("noCandidates")}</p>
        ) : null}
        {(candidates.data ?? []).map((candidate) => (
          <div
            key={candidate.factoryId}
            className="border-border flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
          >
            <Checkbox
              label={`${candidate.name} (${candidate.code})`}
              description={
                candidate.capable
                  ? candidate.alreadyConsulted
                    ? t("alreadyConsulted")
                    : candidate.onTimeShippingPct
                      ? t("onTime", { pct: format.percent(candidate.onTimeShippingPct) })
                      : undefined
                  : t(`reasons.${candidate.reason ?? "quantity_above_maximum"}`)
              }
              disabled={!candidate.capable || candidate.alreadyConsulted}
              checked={chosen.includes(candidate.factoryId)}
              onCheckedChange={(checked) =>
                setChosen((current) =>
                  checked ? [...current, candidate.factoryId] : current.filter((id) => id !== candidate.factoryId),
                )
              }
            />
            <span className="flex flex-wrap gap-1">
              {candidate.status === "trial" ? <Badge size="sm">{t("trial")}</Badge> : null}
              {candidate.tier ? <Badge size="sm">{t("tier", { tier: candidate.tier })}</Badge> : null}
            </span>
          </div>
        ))}
        {missing && chosen.length === 0 ? (
          <p className="text-danger text-sm" role="alert">
            {t("pickOne")}
          </p>
        ) : null}
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label={t("dueAt")}
          hint={t("dueAtHint")}
          required
          error={missing && !dueAt ? t("dueAtRequired") : undefined}
        >
          <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
      </div>
      <Field label={t("note")} hint={t("noteHint")} className="mt-3">
        <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </Dialog>
  );
}
