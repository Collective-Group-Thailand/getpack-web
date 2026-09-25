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
  CRITICAL_FLAGS,
  currentStep,
  decisionBlocker,
  PAYLOAD_KINDS,
  POLICY_ICONS,
  type Approval,
} from "./presentation";

async function fetchApproval(requestId: string): Promise<Approval> {
  const { data } = await adminBrowserApis().contract.GET("/v1/admin/approvals/{requestId}", {
    params: { path: { requestId } },
  });
  return data!;
}

type Decision = "approve" | "reject" | "withdraw";

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
  const mine = approval.requester.id === actor.id;
  const policyLabel = t.has(`policies.${approval.policy}`) ? t(`policies.${approval.policy}`) : approval.policy;
  const summary = `${policyLabel}${approval.amount ? ` · ${format.thb(approval.amount)}` : ""}`;

  const payloadItems = Object.entries(approval.payload as Record<string, unknown>).map(([key, value]) => {
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
      term: t.has(`fields.${key}`) ? t(`fields.${key}`) : key,
      description:
        text === null ? (
          <JsonView value={value} label={key} />
        ) : kind === "code" ? (
          <span className="font-mono">{text}</span>
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

      {blocker === "own_request" ? <Callout tone="info" title={t("blockers.ownRequest")} /> : null}
      {blocker === "already_acted" ? <Callout tone="info" title={t("blockers.alreadyActed")} /> : null}
      {approval.flags.includes("below_margin_floor") ? (
        <Callout tone="danger" title={t("belowFloorTitle")}>
          {t("belowFloorBody")}
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
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
                  title: t.has(`actionKinds.${action.action}`) ? t(`actionKinds.${action.action}`) : action.action,
                  actor: action.onBehalfOf
                    ? t("onBehalfOf", { name: action.actor.displayName, for: action.onBehalfOf.displayName })
                    : action.actor.displayName,
                  time: <When at={action.at} />,
                  description: action.comment ?? undefined,
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
        description={t("confirm.description", { summary })}
        confirmLabel={decision ? t(decision) : ""}
        tone={decision === "approve" ? "primary" : "destructive"}
        reason={
          decision === "approve"
            ? { label: t("comment"), hint: t("commentHint") }
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
