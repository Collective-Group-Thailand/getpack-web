"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  effectiveInstant,
  FormDialog,
  FormError,
  QueryError,
  StatusChip,
  today,
  useCan,
  useRoleLabel,
} from "../console";

type Policy = Schemas["ApprovalPolicyDto"];
type PolicyVersion = Schemas["PolicyVersionDto"];
type Step = Schemas["PolicyStepDto"];
type Scope = Schemas["ApprovalScopeRule"];
type Calendar = Schemas["CalendarBasis"];

const SCOPES = ["platform", "subject_factory", "subject_company", "subject_entity"] as const satisfies readonly Scope[];
const CALENDARS = ["business", "calendar"] as const satisfies readonly Calendar[];

interface EditableStep {
  key: string;
  name: string;
  approverRole: string;
  approverScope: Scope;
  quorum: string;
  condition: string;
  escalateToRole: string;
  slaMinutes: string;
  slaCalendar: Calendar;
}

let counter = 0;
const stepKey = () => `step-${(counter++).toString(36)}`;

const toEditable = (step: Step): EditableStep => ({
  key: stepKey(),
  name: step.name,
  approverRole: step.approverRole,
  approverScope: step.approverScope,
  quorum: String(step.quorum),
  condition: step.condition ? JSON.stringify(step.condition, null, 2) : "",
  escalateToRole: step.escalateToRole ?? "",
  slaMinutes: step.slaMinutes === null ? "" : String(step.slaMinutes),
  slaCalendar: step.slaCalendar,
});

/** A condition as read: "amount ≤ 100000.00", "all of (…)". Falls back to its JSON. */
function conditionText(condition: Record<string, unknown> | null, always: string): string {
  if (!condition) return always;
  const c = condition as {
    all?: unknown[];
    any?: unknown[];
    field?: string;
    op?: string;
    value?: unknown;
    ref?: unknown;
  };
  const ops: Record<string, string> = { lte: "≤", lt: "<", gte: "≥", gt: ">", eq: "=", ne: "≠", in: "∈" };
  if (c.all) return c.all.map((part) => conditionText(part as Record<string, unknown>, always)).join(" AND ");
  if (c.any) return `(${c.any.map((part) => conditionText(part as Record<string, unknown>, always)).join(" OR ")})`;
  if (c.field && c.op) return `${c.field} ${ops[c.op] ?? c.op} ${JSON.stringify(c.value ?? c.ref)}`;
  return JSON.stringify(condition);
}

function StepsList({ steps }: { steps: readonly Step[] }) {
  const t = useTranslations("approvals.matrix");
  const roleLabel = useRoleLabel();
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {steps.map((step) => (
        <li key={step.stepNo} className="border-border flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-2">
          <span className="font-medium">
            {step.stepNo}. {step.name}
          </span>
          <span>{t("approver", { role: roleLabel(step.approverRole), quorum: step.quorum })}</span>
          <span className="text-muted">{t(`scopes.${step.approverScope}`)}</span>
          <span className="text-muted font-mono text-xs">{conditionText(step.condition, t("always"))}</span>
          {step.slaMinutes ? (
            <span className="text-muted">
              {t("sla", { minutes: step.slaMinutes, calendar: t(`calendars.${step.slaCalendar}`) })}
              {step.escalateToRole ? ` · ${t("escalate", { role: roleLabel(step.escalateToRole) })}` : ""}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The approval matrix (ADR-0006, D-063): every approval policy with its steps in force, a version
 * approved for a later date and a proposal waiting. A change is proposed as a new version and
 * approved by a Superadmin who did not propose it (`approval_policy_change`); the running version
 * is never edited.
 */
export function ApprovalMatrix() {
  const t = useTranslations("approvals.matrix");
  const tPolicies = useTranslations("approvals.policies");
  const format = useFormat();
  const canManage = useCan("approval_policies.manage");
  const [editing, setEditing] = useState<Policy | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const policies = useQuery({
    queryKey: queryKeys.list("admin", "approval_policy"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approval-policies")).data!,
  });
  if (policies.isError) return <QueryError error={policies.error} onRetry={() => void policies.refetch()} />;
  if (!policies.data) return <Skeleton className="h-64" />;
  if (policies.data.length === 0) return <EmptyState icon="stamp" title={t("empty")} />;

  const versionLine = (version: PolicyVersion, label: string) => (
    <p className="text-muted text-xs">
      {label}: {t("versionLine", { no: version.versionNo, date: format.dateTime(version.effectiveFrom) })}
      {version.createdBy ? ` · ${t("by", { name: version.createdBy.displayName })}` : ""} · {version.reason}
    </p>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("body")}</p>
      {policies.data.map((policy) => (
        <Card key={policy.id} padding="lg">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {tPolicies.has(policy.key) ? tPolicies(policy.key) : policy.key}
                <span className="text-muted font-mono text-xs">{policy.key}</span>
                {policy.pending ? (
                  <Badge size="sm" tone="warning" icon="stamp">
                    {t("pending", { no: policy.pending.versionNo })}
                  </Badge>
                ) : null}
              </CardTitle>
              <p className="text-muted text-sm">{policy.description}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setHistory(history === policy.id ? null : policy.id)}>
                {history === policy.id ? t("hideHistory") : t("showHistory")}
              </Button>
              {canManage ? (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="edit"
                  disabled={Boolean(policy.pending)}
                  title={policy.pending ? t("oneAtATime") : undefined}
                  onClick={() => setEditing(policy)}
                >
                  {t("propose")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          {policy.current ? (
            <>
              {versionLine(policy.current, t("inForce"))}
              <StepsList steps={policy.current.steps} />
            </>
          ) : (
            <p className="text-muted text-sm">{t("noneInForce")}</p>
          )}
          {policy.upcoming ? <div className="mt-3">{versionLine(policy.upcoming, t("upcoming"))}</div> : null}
          {policy.pending ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {versionLine(policy.pending, t("proposal"))}
              {policy.pending.approvalId ? (
                <Link href={`/approvals/${policy.pending.approvalId}`} className="text-primary text-sm underline">
                  {t("openApproval")}
                </Link>
              ) : null}
            </div>
          ) : null}
          {history === policy.id ? <PolicyHistory policyId={policy.id} /> : null}
        </Card>
      ))}
      {editing ? (
        <ProposeVersionDialog
          policy={editing}
          onClose={() => setEditing(null)}
          onDone={() => void policies.refetch()}
        />
      ) : null}
    </div>
  );
}

function PolicyHistory({ policyId }: { policyId: string }) {
  const t = useTranslations("approvals.matrix");
  const format = useFormat();
  const versions = useQuery({
    queryKey: queryKeys.related("admin", "approval_policy", policyId, "versions"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/approval-policies/{policyId}/versions", {
          params: { path: { policyId } },
        })
      ).data!,
  });
  if (versions.isError) return <QueryError error={versions.error} onRetry={() => void versions.refetch()} />;
  if (!versions.data) return <Skeleton className="mt-3 h-24" />;
  return (
    <ul className="mt-4 flex flex-col gap-4" aria-label={t("history")}>
      {versions.data.map((version) => (
        <li key={version.versionNo} className="bg-surface-subtle rounded-md p-3">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t("versionNo", { no: version.versionNo })}</span>
            <StatusChip map={SETTING_VERSION_STATUS} value={version.status} />
            <span className="text-muted">
              {t("versionLine", { no: version.versionNo, date: format.dateTime(version.effectiveFrom) })}
              {version.createdBy ? ` · ${t("by", { name: version.createdBy.displayName })}` : ""} · {version.reason}
            </span>
          </p>
          <StepsList steps={version.steps} />
        </li>
      ))}
    </ul>
  );
}

function ProposeVersionDialog({
  policy,
  onClose,
  onDone,
}: {
  policy: Policy;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("approvals.propose");
  const tMatrix = useTranslations("approvals.matrix");
  const roleLabel = useRoleLabel();
  const canReadRoles = useCan("users.read");
  const [steps, setSteps] = useState<EditableStep[]>(() => (policy.current?.steps ?? []).map(toEditable));
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [reason, setReason] = useState("");
  // One key for this proposal, so a retry after a timeout cannot propose twice.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const roles = useQuery({
    enabled: canReadRoles,
    queryKey: queryKeys.list("admin", "role"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/roles")).data!,
  });
  const roleKeys = [
    ...new Set([
      ...(roles.data ?? []).filter((role) => role.audience === "staff").map((role) => role.key),
      ...steps.flatMap((step) => [step.approverRole, step.escalateToRole]).filter(Boolean),
    ]),
  ];
  const roleOptions = roleKeys.map((key) => ({ value: key, label: `${roleLabel(key)} (${key})` }));
  const set = (key: string, patch: Partial<EditableStep>) =>
    setSteps(steps.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    const [step] = next.splice(index, 1);
    next.splice(index + by, 0, step!);
    setSteps(next);
  };

  return (
    <FormDialog
      size="xl"
      title={t("title", { policy: policy.key })}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (steps.length === 0) throw new FormError(t("errors.none"));
        const body = steps.map((step, index) => {
          const n = index + 1;
          if (step.name.trim().length < 2) throw new FormError(t("errors.name", { n }));
          if (!/^[a-z][a-z_]{1,63}$/.test(step.approverRole)) throw new FormError(t("errors.role", { n }));
          if (!/^[1-5]$/.test(step.quorum.trim())) throw new FormError(t("errors.quorum", { n }));
          if (step.slaMinutes.trim() && !/^\d{1,6}$/.test(step.slaMinutes.trim()))
            throw new FormError(t("errors.sla", { n }));
          let condition: Record<string, unknown> | null = null;
          if (step.condition.trim()) {
            try {
              const parsed: unknown = JSON.parse(step.condition);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
              condition = parsed as Record<string, unknown>;
            } catch {
              throw new FormError(t("errors.condition", { n }));
            }
          }
          return {
            name: step.name.trim(),
            approverRole: step.approverRole,
            approverScope: step.approverScope,
            quorum: Number(step.quorum),
            condition,
            escalateToRole: step.escalateToRole || null,
            slaMinutes: step.slaMinutes.trim() ? Number(step.slaMinutes) : null,
            slaCalendar: step.slaCalendar,
          };
        });
        if (effectiveFrom < today()) throw new FormError(t("errors.backDated"));
        if (reason.trim().length < 3) throw new FormError(t("errors.reason"));
        await adminBrowserApis().contract.POST("/v1/admin/approval-policies/{policyId}/versions", {
          params: { path: { policyId: policy.id }, header: { "Idempotency-Key": idempotencyKey } },
          body: { effectiveFrom: effectiveInstant(effectiveFrom), reason: reason.trim(), steps: body },
        });
        toast.success(t("done"));
        onDone();
        onClose();
      }}
    >
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.key} className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-4">
            <Field label={t("name", { n: index + 1 })} className="sm:col-span-2">
              <Input value={step.name} onChange={(event) => set(step.key, { name: event.target.value })} />
            </Field>
            <Field label={t("role", { n: index + 1 })}>
              <SearchableSelect
                value={step.approverRole || undefined}
                placeholder={t("choose")}
                onValueChange={(approverRole) => set(step.key, { approverRole })}
                options={roleOptions}
              />
            </Field>
            <div className="flex items-end justify-end gap-1">
              <IconButton
                name="chevron-up"
                variant="ghost"
                label={t("up", { n: index + 1 })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                name="chevron-down"
                variant="ghost"
                label={t("down", { n: index + 1 })}
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                name="trash"
                variant="ghost"
                label={t("remove", { n: index + 1 })}
                onClick={() => setSteps(steps.filter((candidate) => candidate.key !== step.key))}
              />
            </div>
            <Field label={t("scope", { n: index + 1 })}>
              <NativeSelect
                value={step.approverScope}
                onValueChange={(approverScope) => set(step.key, { approverScope: approverScope as Scope })}
                options={SCOPES.map((value) => ({ value, label: tMatrix(`scopes.${value}`) }))}
              />
            </Field>
            <Field label={t("quorum", { n: index + 1 })}>
              <NumberInput
                min={1}
                max={5}
                value={step.quorum}
                onChange={(event) => set(step.key, { quorum: event.target.value })}
              />
            </Field>
            <Field label={t("slaMinutes", { n: index + 1 })} hint={t("slaHint")}>
              <NumberInput
                min={0}
                value={step.slaMinutes}
                onChange={(event) => set(step.key, { slaMinutes: event.target.value })}
              />
            </Field>
            <Field label={t("calendar", { n: index + 1 })}>
              <NativeSelect
                value={step.slaCalendar}
                onValueChange={(slaCalendar) => set(step.key, { slaCalendar: slaCalendar as Calendar })}
                options={CALENDARS.map((value) => ({ value, label: tMatrix(`calendars.${value}`) }))}
              />
            </Field>
            <Field label={t("escalate", { n: index + 1 })} className="sm:col-span-2">
              <SearchableSelect
                value={step.escalateToRole || "none"}
                onValueChange={(value) => set(step.key, { escalateToRole: value === "none" ? "" : value })}
                options={[{ value: "none", label: t("noEscalation") }, ...roleOptions]}
              />
            </Field>
            <Field label={t("condition", { n: index + 1 })} hint={t("conditionHint")} className="sm:col-span-2">
              <Textarea
                rows={3}
                className="font-mono text-xs"
                value={step.condition}
                onChange={(event) => set(step.key, { condition: event.target.value })}
              />
            </Field>
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        variant="secondary"
        iconStart="plus"
        className="self-start"
        onClick={() =>
          setSteps([
            ...steps,
            {
              key: stepKey(),
              name: "",
              approverRole: "",
              approverScope: "platform",
              quorum: "1",
              condition: "",
              escalateToRole: "",
              slaMinutes: "",
              slaCalendar: "business",
            },
          ])
        }
      >
        {t("add")}
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("effectiveFrom")} hint={t("effectiveHint")} required>
          <Input
            type="date"
            min={today()}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
        <Field label={t("reason")} required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}
