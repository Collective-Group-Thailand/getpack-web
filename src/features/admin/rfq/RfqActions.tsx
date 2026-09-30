"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { AdminRfqAction } from "@/domain/next-actions/admin";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, AssignDialog, ConfirmAction, NextActionBar, problemMessage } from "../console";
import { useSettleRfq, useUnmetDemandReasons } from "./data";
import { draftOf, sentOf, type Rfq } from "./resources";

export type RfqActionKey =
  | "start_review"
  | "assign"
  | "request_info"
  | "request_factory_cost"
  | "compose_quote"
  | "edit_quote"
  | "send_quote"
  | "record_acceptance"
  | "decline"
  | "create_order";

const SUPPORTED = new Set<string>([
  "start_review",
  "assign",
  "request_info",
  "request_factory_cost",
  "compose_quote",
  "edit_quote",
  "send_quote",
  "record_acceptance",
  "decline",
  "create_order",
]);

/** The RFQ's actions as `adminRfqActions` offers them — see `NextActionBar`. */
export function RfqActionBar({
  actions,
  onAction,
}: {
  actions: AdminRfqAction[];
  onAction: (key: RfqActionKey) => void;
}) {
  const t = useTranslations("rfq.actions");
  return (
    <NextActionBar
      actions={actions.map(({ key, irreversible, blockedBy }) => ({
        key,
        irreversible,
        disabledReason: blockedBy ? t(`blocked.${blockedBy}`) : null,
      }))}
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
  const [quantity, setQuantity] = useState("");
  const reasons = useUnmetDemandReasons(open === "decline");

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };
  const { contract, requests } = adminBrowserApis();

  switch (open) {
    case "assign":
      return (
        <AssignDialog
          title={t("assign.title")}
          description={t("assign.body", { code: rfq.rfqCode })}
          current={rfq.assignedTo}
          permission="rfqs.manage"
          personHint={t("assign.personHint")}
          // CONTRACT-GAP admin.rfq-actions — `admin.rfqs.assign` takes a person; it cannot unassign.
          clearable={false}
          onAssign={async (userId) => {
            if (!userId) return;
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
          onConfirm={async ({ reason }) => {
            if (!reasonCode) {
              toast.error(t("decline.needReason"));
              throw new Error("reason code required");
            }
            try {
              // `admin.rfqs.decline` declares no Idempotency-Key.
              const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/actions/decline", {
                params: { path: { rfqId } },
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
            <Select
              value={reasonCode || undefined}
              onValueChange={setReasonCode}
              placeholder={t("decline.choose")}
              options={(reasons.data?.data ?? []).map((reason) => ({ value: reason.code, label: reason.name }))}
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
          onConfirm={async () => {
            try {
              // `admin.rfqs.sendQuotation` declares no Idempotency-Key; the API sets the validity (D-051).
              const { data } = await contract.POST("/v1/admin/rfq-quotations/{rfqQuoteId}/actions/send", {
                params: { path: { rfqQuoteId: draft.id } },
              });
              settle(data);
              toast.success(t("send.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      ) : null;
    case "record_acceptance":
      return sent ? (
        <ConfirmAction
          {...common}
          title={t("accept.title", { version: sent.versionNo })}
          description={t("accept.body", { code: rfq.rfqCode, customer: rfq.customer.displayName })}
          confirmLabel={t("accept.confirm")}
          confirmationPhrase={rfq.rfqCode}
          reason={{ label: t("accept.note"), required: true, minLength: 3, hint: t("accept.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            const chosen = Number(quantity || (sent.lines.length === 1 ? sent.lines[0]!.quantity : 0));
            if (!chosen) {
              toast.error(t("accept.needQuantity"));
              throw new Error("quantity required");
            }
            try {
              // Still a contract request (admin.rfq-quotes): its answer is not the published RFQ,
              // so the RFQ is read again.
              await requests.call("POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/record-acceptance", {
                path: { rfqId, quoteId: sent.id },
                body: { quantity: chosen, note: reason },
                idempotencyKey,
              });
              settle();
              toast.success(t("accept.done"));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <Field label={t("accept.quantity")} required>
            <Select
              value={quantity || (sent.lines.length === 1 ? String(sent.lines[0]!.quantity) : undefined)}
              onValueChange={setQuantity}
              placeholder={t("accept.chooseQuantity")}
              options={sent.lines.map((line) => ({
                value: String(line.quantity),
                label: t("accept.option", {
                  quantity: format.number(line.quantity),
                  amount: format.thb(line.grossAmount),
                }),
              }))}
            />
          </Field>
        </ConfirmAction>
      ) : null;
    default:
      return null;
  }
}

/**
 * "Request cost from factory" (F2 2.3): the factories the API says could make this category,
 * with their D-043 tier and on-time rate; one that cannot says why and cannot be picked.
 *
 * `admin.rfqs.requestConsultation` asks one factory per call and declares no Idempotency-Key, so
 * the dialog asks each chosen factory in turn (CONTRACT-GAP admin.rfq-consultations — no
 * multi-factory request). A failure stops the run; the factories already asked stay asked, and
 * the RFQ the last call answered shows them.
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

  const candidates = useQuery({
    queryKey: queryKeys.related("admin", "rfq", rfq.id, "candidate_factories"),
    // Still a contract request (admin.rfq-consultations).
    queryFn: () =>
      adminBrowserApis().requests.call("GET /v1/admin/rfqs/{rfqId}/candidate-factories", { path: { rfqId: rfq.id } }),
    staleTime: STALE_TIME.transactional,
  });

  const request = useMutation({
    mutationFn: async () => {
      const { contract } = adminBrowserApis();
      let latest: Rfq | undefined;
      let asked = 0;
      try {
        for (const factoryId of chosen) {
          const { data } = await contract.POST("/v1/admin/rfqs/{rfqId}/consultations", {
            params: { path: { rfqId: rfq.id } },
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
        {(candidates.data?.data ?? []).map((candidate) => (
          <div
            key={candidate.factory.id}
            className="border-border flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
          >
            <Checkbox
              label={candidate.factory.name}
              description={
                candidate.capable
                  ? candidate.alreadyConsulted
                    ? t("alreadyConsulted")
                    : candidate.onTimeRatePct
                      ? t("onTime", { pct: format.percent(candidate.onTimeRatePct) })
                      : undefined
                  : (candidate.reason ?? t("notCapable"))
              }
              disabled={!candidate.capable || candidate.alreadyConsulted}
              checked={chosen.includes(candidate.factory.id)}
              onCheckedChange={(checked) =>
                setChosen((current) =>
                  checked ? [...current, candidate.factory.id] : current.filter((id) => id !== candidate.factory.id),
                )
              }
            />
            {candidate.tier ? <Badge size="sm">{t("tier", { tier: candidate.tier })}</Badge> : null}
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
