"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, NextActionBar, problemMessage, useActor, useRoleLabel } from "../console";
import type { Rfq } from "./resources";

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

/** The RFQ's actions, exactly as the API offered them — see `NextActionBar`. */
export function RfqActionBar({ rfq, onAction }: { rfq: Rfq; onAction: (key: RfqActionKey) => void }) {
  const t = useTranslations("rfq.actions");
  return (
    <NextActionBar
      actions={rfq.nextActions}
      supported={SUPPORTED}
      labelOf={(key) => (t.has(`labels.${key}`) ? t(`labels.${key}`) : undefined)}
      onAction={(key) => onAction(key as RfqActionKey)}
    />
  );
}

/** Keeps the screen, the queues and the dashboard counts in step after an action. */
function useSettle(rfqId: string) {
  const queryClient = useQueryClient();
  return (updated?: Rfq) => {
    if (updated) queryClient.setQueryData(queryKeys.detail("admin", "rfq", rfqId), updated);
    else void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "rfq", rfqId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "rfq") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "rfq", rfqId, "messages") });
  };
}

/** The dialog for whichever action is open. One component so every action shares the same rules. */
export function RfqActionDialogs({ rfq, open, onClose }: { rfq: Rfq; open: RfqActionKey | null; onClose: () => void }) {
  const t = useTranslations("rfq.actions");
  const format = useFormat();
  const settle = useSettle(rfq.id);
  const rfqId = rfq.id;
  const draft = rfq.quotes.find((quote) => quote.status === "draft");
  const sent = rfq.quotes.find((quote) => quote.status === "sent");
  const [reasonCode, setReasonCode] = useState("");
  const [quantity, setQuantity] = useState("");

  const reasons = useQuery({
    queryKey: queryKeys.list("admin", "unmet_demand_reason", {}),
    queryFn: () => browserRequests().call("GET /v1/admin/unmet-demand-reasons"),
    staleTime: STALE_TIME.reference,
    enabled: open === "decline",
  });

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };

  switch (open) {
    case "assign":
      return <AssignDialog rfq={rfq} onClose={onClose} onDone={settle} />;
    case "request_factory_cost":
      return <ConsultDialog rfq={rfq} onClose={onClose} onDone={() => settle()} />;
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
              settle(
                await browserRequests().call("POST /v1/admin/rfqs/{rfqId}/actions/request-info", {
                  path: { rfqId },
                  body: { message: reason },
                }),
              );
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
              settle(
                await browserRequests().call("POST /v1/admin/rfqs/{rfqId}/actions/decline", {
                  path: { rfqId },
                  body: { reasonCode, ...(reason ? { note: reason } : {}) },
                  idempotencyKey,
                }),
              );
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
              <span className="block">
                {t("send.body", {
                  code: rfq.rfqCode,
                  customer: rfq.customer.displayName,
                  validUntil: format.date(draft.validUntil),
                })}
              </span>
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
              settle(
                await browserRequests().call("POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/send", {
                  path: { rfqId, quoteId: draft.id },
                  idempotencyKey,
                }),
              );
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
              settle(
                await browserRequests().call("POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/record-acceptance", {
                  path: { rfqId, quoteId: sent.id },
                  body: { quantity: chosen, note: reason },
                  idempotencyKey,
                }),
              );
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

function AssignDialog({ rfq, onClose, onDone }: { rfq: Rfq; onClose: () => void; onDone: (rfq: Rfq) => void }) {
  const t = useTranslations("rfq.actions.assign");
  const tCommon = useTranslations("common");
  const actor = useActor();
  const roleLabel = useRoleLabel();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ComboboxOption | null>(null);

  const people = useQuery({
    queryKey: queryKeys.list("admin", "staff_directory", { q: query, permission: "rfq.manage" }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/staff-directory", {
        query: { q: query || undefined, permission: "rfq.manage", limit: 20 },
      }),
    staleTime: STALE_TIME.reference,
  });

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      browserRequests().call("POST /v1/admin/rfqs/{rfqId}/actions/assign", {
        path: { rfqId: rfq.id },
        body: { assigneeId },
      }),
    onSuccess: (updated, assigneeId) => {
      onDone(updated);
      toast.success(assigneeId ? t("done", { name: updated.assignee?.displayName ?? "" }) : t("cleared"));
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      description={t("body", { code: rfq.rfqCode })}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          {rfq.assignee ? (
            <Button
              variant="ghost"
              loading={assign.isPending && assign.variables === null}
              onClick={() => assign.mutate(null)}
            >
              {t("clear")}
            </Button>
          ) : null}
          {rfq.assignee?.id !== actor.id ? (
            <Button variant="secondary" onClick={() => assign.mutate(actor.id)}>
              {t("me")}
            </Button>
          ) : null}
          <Button
            disabled={!picked}
            loading={assign.isPending && assign.variables === picked?.value}
            onClick={() => picked && assign.mutate(picked.value)}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      {rfq.assignee ? (
        <p className="text-muted mb-3 text-sm">{t("current", { name: rfq.assignee.displayName })}</p>
      ) : null}
      <Field label={t("person")} hint={t("personHint")}>
        <Combobox
          value={picked}
          onValueChange={setPicked}
          query={query}
          onQueryChange={setQuery}
          loading={people.isFetching}
          options={(people.data?.data ?? []).map((person) => ({
            value: person.id,
            label: person.displayName,
            description: person.roles.map(roleLabel).join(", "),
          }))}
          placeholder={t("placeholder")}
          labels={{ loading: tCommon("state.loading"), empty: t("nobody"), clear: t("clearPick") }}
        />
      </Field>
    </Dialog>
  );
}

/**
 * "Request cost from factory" (F2 2.3): the factories the API says could make this category,
 * with their D-043 tier and on-time rate; one that cannot says why and cannot be picked.
 */
function ConsultDialog({ rfq, onClose, onDone }: { rfq: Rfq; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("rfq.actions.consult");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const [chosen, setChosen] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [missing, setMissing] = useState(false);

  const candidates = useQuery({
    queryKey: queryKeys.related("admin", "rfq", rfq.id, "candidate_factories"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/rfqs/{rfqId}/candidate-factories", { path: { rfqId: rfq.id } }),
    staleTime: STALE_TIME.transactional,
  });

  const request = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/rfqs/{rfqId}/consultations", {
        path: { rfqId: rfq.id },
        body: { factoryIds: chosen, dueAt: `${dueAt}:00+07:00`, ...(note.trim() ? { note: note.trim() } : {}) },
        idempotencyKey,
      }),
    onSuccess: (result) => {
      toast.success(t("done", { count: result.data.length }));
      onDone();
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
      description={t("body", { code: rfq.rfqCode, type: rfq.productType.name })}
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
