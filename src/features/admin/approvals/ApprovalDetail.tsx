"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { APPROVAL_STATUS, APPROVAL_STEP_STATUS, statusMeta } from "@/domain/status";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { JsonView } from "@/ui/components/JsonView";
import { PageHeader } from "@/ui/components/PageHeader";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueryError,
  useActor,
  useCan,
  useRoleLabel,
  useSlaFormat,
} from "../console";
import {
  canOfferSelfApproval,
  CRITICAL_FLAGS,
  currentStep,
  decisionBlocker,
  PAYLOAD_KINDS,
  POLICY_ICONS,
  TYPED_REASON_MIN_LENGTH,
  type Approval,
} from "./presentation";
import { SoloOwnerBadge, useSoloOwnerMode } from "./SoloOwnerMode";

async function fetchApproval(requestId: string): Promise<Approval> {
  const { data } = await adminBrowserApis().contract.GET("/v1/admin/approvals/{requestId}", {
    params: { path: { requestId } },
  });
  return data!;
}

type Decision = "approve" | "reject" | "withdraw" | "self";

export function ApprovalDetail({ requestId, initial }: { requestId: string; initial: Approval | null }) {
  const t = useTranslations("approvals");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const roleLabel = useRoleLabel();
  const actor = useActor();
  const canAct = useCan("approvals.act");
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision | null>(null);
  const solo = useSoloOwnerMode();

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "approval", requestId),
    queryFn: () => fetchApproval(requestId),
    initialData: initial ?? undefined,
  });

  const decide = useMutation({
    mutationFn: async ({ kind, comment }: { kind: Decision; comment: string }) => {
      const api = adminBrowserApis().contract;
      const path = { params: { path: { requestId } } };
      if (kind === "approve")
        return (
          await api.POST("/v1/admin/approvals/{requestId}/actions/approve", {
            ...path,
            body: comment ? { comment } : {},
          })
        ).data;
      // D-449 A: a Superadmin's own request under solo-owner mode, with the typed reason.
      if (kind === "self")
        return (
          await api.POST("/v1/admin/approvals/{requestId}/actions/approve", {
            ...path,
            body: { selfApprovalReason: comment },
          })
        ).data;
      if (kind === "reject")
        return (await api.POST("/v1/admin/approvals/{requestId}/actions/reject", { ...path, body: { comment } })).data;
      return (
        await api.POST("/v1/admin/approvals/{requestId}/actions/withdraw", { ...path, body: { reason: comment } })
      ).data;
    },
    onSuccess: (updated, { kind }) => {
      toast.success(t(`decided.${kind}`));
      if (updated) queryClient.setQueryData(queryKeys.detail("admin", "approval", requestId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
    },
    onError: (error) => toast.error(problemMessage(error, t("decideFailed"))),
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const approval = query.data;
  if (!approval) return null;

  const step = currentStep(approval);
  const blocker = decisionBlocker(approval, actor.id);
  // Who can decide now: the API still enforces it; this only says so instead of hiding the buttons
  // without a word (UX audit, approvals: "role ไม่มีสิทธิ์ให้แสดง รอผู้อนุมัติ").
  const mine = approval.requester.id === actor.id;
  const selfOffer = canOfferSelfApproval(approval, actor, solo.data);
  const waitingOnOthers = approval.status === "pending" && !blocker && !mine && !canAct;
  const policyLabel = t.has(`policies.${approval.policy}`) ? t(`policies.${approval.policy}`) : approval.policy;
  const summary = `${policyLabel}${approval.amount ? ` · ${format.thb(approval.amount)}` : ""}`;

  // A snapshot reads as labelled facts: an empty value says nothing, so it is left out (UX audit:
  // "ซ่อน null"), and a key without a label is humanised rather than shown as raw JSON.
  const payloadItems = Object.entries(approval.payload as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    // An internal id (a UUID) means nothing to a person; the snapshot's names and codes carry it.
    .filter(([, value]) => !(typeof value === "string" && UUID.test(value)))
    .map(([key, value]) => {
      const kind = PAYLOAD_KINDS[key];
      const text =
        kind === "money" && typeof value === "string"
          ? format.thb(value)
          : kind === "percent" && typeof value === "string"
            ? format.percent(value)
            : kind === "number" && typeof value === "number"
              ? format.number(value)
              : typeof value === "string" || typeof value === "number"
                ? String(value)
                : null;
      return {
        term: t.has(`fields.${key}`) ? t(`fields.${key}`) : humanise(key),
        description:
          text === null ? (
            <JsonView value={value} label={key} />
          ) : kind === "code" ? (
            <span className="tabular-nums">{text}</span>
          ) : (
            text
          ),
        wide: key === "reason" || text === null,
      };
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/approvals" }, { label: policyLabel }]}
          />
        }
        title={
          <span className="flex items-center gap-2">
            <Icon name={POLICY_ICONS[approval.policy] ?? "stamp"} size={22} className="text-muted" />
            {policyLabel}
          </span>
        }
        meta={
          <>
            <StatusBadge
              meta={statusMeta(APPROVAL_STATUS, approval.status)}
              label={tStatus(statusMeta(APPROVAL_STATUS, approval.status).labelKey)}
            />
            {approval.flags.map((flag) => (
              <Badge key={flag} tone={CRITICAL_FLAGS.has(flag) ? "danger" : "warning"} icon="warning">
                {t.has(`flags.${flag}`) ? t(`flags.${flag}`) : flag}
              </Badge>
            ))}
            {approval.selfApproved ? (
              <Badge tone="warning" icon="key">
                {t("badges.selfApproved")}
              </Badge>
            ) : null}
            {approval.autoApprovedReason === "below_threshold" ? (
              <Badge tone="info" icon="zap">
                {t("badges.autoApproved")}
              </Badge>
            ) : null}
            {approval.status === "pending" ? <SoloOwnerBadge mode={solo.data} /> : null}
          </>
        }
        description={t("requestedBy", { name: approval.requester.displayName })}
        actions={
          approval.status === "pending" ? (
            <>
              {mine ? (
                <Button variant="secondary" iconStart="undo" onClick={() => setDecision("withdraw")}>
                  {t("withdraw")}
                </Button>
              ) : null}
              {selfOffer ? (
                <Button iconStart="check" onClick={() => setDecision("self")}>
                  {t("selfApprove.action")}
                </Button>
              ) : null}
              {canAct && !blocker ? (
                <>
                  <Button variant="secondary" iconStart="ban" onClick={() => setDecision("reject")}>
                    {t("reject")}
                  </Button>
                  <Button iconStart="check" onClick={() => setDecision("approve")}>
                    {t("approve")}
                  </Button>
                </>
              ) : null}
            </>
          ) : undefined
        }
      />

      {waitingOnOthers && step ? (
        <Callout tone="info" title={t("waitingForOther", { role: roleLabel(step.role) })}>
          <span className="flex flex-wrap items-center gap-x-2">
            {t("waitingForOtherBody")}
            <SlaTimer dueAt={step.dueAt} format={sla} absolute={format.dateTime(step.dueAt)} />
          </span>
        </Callout>
      ) : null}
      {blocker === "own_request" ? (
        selfOffer ? (
          <Callout tone="warning" title={t("selfApprove.calloutTitle")}>
            {t("selfApprove.calloutBody")}
          </Callout>
        ) : (
          <Callout tone="info" title={t("blockers.ownRequest")} />
        )
      ) : null}
      {approval.autoApprovedReason === "below_threshold" ? (
        <Callout tone="info" title={t("autoApproved.title")}>
          {t("autoApproved.body")}
        </Callout>
      ) : null}
      {blocker === "already_acted" ? <Callout tone="info" title={t("blockers.alreadyActed")} /> : null}
      {approval.flags.includes("below_margin_floor") ? (
        <Callout tone="danger" title={t("belowFloorTitle")}>
          {t("belowFloorBody")}
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("summary")}</CardTitle>
            </CardHeader>
            <DescriptionList
              items={[
                ...(approval.amount
                  ? [
                      {
                        term: t("amount"),
                        description: <span className="tabular-nums">{format.thb(approval.amount)}</span>,
                      },
                    ]
                  : []),
                ...(approval.pct ? [{ term: t("pct"), description: format.percent(approval.pct) }] : []),
                { term: t("requester"), description: approval.requester.displayName },
                { term: t("createdAt"), description: <When at={approval.createdAt} /> },
                { term: t("expiresAt"), description: <When at={approval.expiresAt} /> },
                ...(approval.decidedAt
                  ? [{ term: t("decidedAt"), description: <When at={approval.decidedAt} /> }]
                  : []),
              ]}
            />
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("payload")}</CardTitle>
            </CardHeader>
            <p className="text-muted mb-3 text-sm">{t("payloadHint")}</p>
            {payloadItems.length > 0 ? (
              <DescriptionList items={payloadItems} />
            ) : (
              <p className="text-muted text-sm">{t("noPayload")}</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("steps")}</CardTitle>
            </CardHeader>
            <ol className="space-y-3">
              {approval.steps.map((item) => {
                const meta = statusMeta(APPROVAL_STEP_STATUS, item.status);
                return (
                  <li key={item.stepNo} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{t("stepOf", { no: item.stepNo, role: roleLabel(item.role) })}</p>
                      {item.status === "pending" && item.stepNo === approval.currentStepNo ? (
                        <SlaTimer dueAt={item.dueAt} format={sla} absolute={format.dateTime(item.dueAt)} />
                      ) : item.completedAt ? (
                        <p className="text-muted text-xs">
                          <When at={item.completedAt} />
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />
                  </li>
                );
              })}
            </ol>
            {step && approval.status === "pending" ? (
              <p className="text-muted mt-3 text-xs">{t("waitingFor", { role: roleLabel(step.role) })}</p>
            ) : null}
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            {approval.actions.length > 0 ? (
              <Timeline
                label={t("history")}
                items={approval.actions.map((action, index) => ({
                  id: String(index),
                  title: action.selfApproved
                    ? t("badges.selfApproved")
                    : t.has(`actionKinds.${action.action}`)
                      ? t(`actionKinds.${action.action}`)
                      : action.action,
                  actor: action.onBehalfOf
                    ? t("onBehalfOf", { name: action.actor.displayName, for: action.onBehalfOf.displayName })
                    : action.actor.displayName,
                  time: <When at={action.at} />,
                  description: action.selfApproved
                    ? [action.selfApprovalReason, action.comment].filter(Boolean).join(" · ") || undefined
                    : (action.comment ?? undefined),
                  icon: action.action === "approve" ? "check" : action.action === "reject" ? "ban" : "undo",
                  tone: action.action === "approve" ? "success" : action.action === "reject" ? "danger" : "neutral",
                }))}
              />
            ) : (
              <p className="text-muted text-sm">{t("noHistory")}</p>
            )}
          </Card>
        </div>
      </div>

      <ConfirmAction
        open={decision !== null}
        onOpenChange={(open) => (open ? undefined : setDecision(null))}
        title={decision ? t(`confirm.${decision}Title`) : ""}
        description={
          decision === "self" ? t("selfApprove.confirmBody", { summary }) : t("confirm.description", { summary })
        }
        confirmLabel={decision === "self" ? t("selfApprove.action") : decision ? t(decision) : ""}
        tone={decision === "approve" || decision === "self" ? "primary" : "destructive"}
        reason={
          decision === "approve"
            ? { label: t("comment"), hint: t("commentHint") }
            : decision === "self"
              ? {
                  label: t("selfApprove.reason"),
                  required: true,
                  minLength: TYPED_REASON_MIN_LENGTH,
                  hint: t("selfApprove.reasonHint", { min: TYPED_REASON_MIN_LENGTH }),
                }
              : {
                  label: decision === "withdraw" ? t("withdrawReason") : t("rejectReason"),
                  required: true,
                  hint: t("commentHint"),
                }
        }
        onConfirm={async ({ reason }) => {
          await decide.mutateAsync({ kind: decision!, comment: reason });
        }}
      />
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `poNumber` → "Po number": a field the copy has no label for yet still reads as words. */
function humanise(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
