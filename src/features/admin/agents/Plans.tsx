"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_PLAN_VERSION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useActor,
  useCan,
} from "../console";
import type { AgentKind, AgentPlan, AgentPlanTerms, AgentPlanVersion } from "./resources";
import { bangkokToday, KindBadge, TermsList, usePlans, useRefreshAgents } from "./shared";

type TermsDraft = Record<keyof AgentPlanTerms, string>;

const BLANK: TermsDraft = {
  firstOrderPct: "5",
  repeatOrderPct: "3",
  attributionMonths: "12",
  marginCapPct: "30",
  minBaseAmount: "0",
  factoryBountyAmount: "0",
  factoryQualifyJobs: "3",
  factoryQualifyDays: "120",
};

const termsOf = (terms: AgentPlanTerms): TermsDraft => ({
  firstOrderPct: terms.firstOrderPct,
  repeatOrderPct: terms.repeatOrderPct,
  attributionMonths: String(terms.attributionMonths),
  marginCapPct: terms.marginCapPct,
  minBaseAmount: terms.minBaseAmount,
  factoryBountyAmount: terms.factoryBountyAmount,
  factoryQualifyJobs: String(terms.factoryQualifyJobs),
  factoryQualifyDays: String(terms.factoryQualifyDays),
});

const PCT = /^\d{1,2}(\.\d{1,2})?$/;
const MONEY = /^\d+(\.\d{1,2})?$/;
const INT = /^\d+$/;

/** Checks the figures and turns them into the API's shape; throws a `FormError` naming the field. */
function parseTerms(draft: TermsDraft, t: (key: string) => string) {
  for (const field of ["firstOrderPct", "repeatOrderPct", "marginCapPct"] as const) {
    if (!PCT.test(draft[field].trim())) throw new FormError(t(`errors.${field}`));
  }
  for (const field of ["minBaseAmount", "factoryBountyAmount"] as const) {
    if (!MONEY.test(draft[field].trim())) throw new FormError(t(`errors.${field}`));
  }
  for (const field of ["attributionMonths", "factoryQualifyJobs", "factoryQualifyDays"] as const) {
    if (!INT.test(draft[field].trim()) || Number(draft[field]) < 1) throw new FormError(t(`errors.${field}`));
  }
  return {
    firstOrderPct: Number(draft.firstOrderPct).toFixed(2),
    repeatOrderPct: Number(draft.repeatOrderPct).toFixed(2),
    marginCapPct: Number(draft.marginCapPct).toFixed(2),
    minBaseAmount: Number(draft.minBaseAmount).toFixed(2),
    factoryBountyAmount: Number(draft.factoryBountyAmount).toFixed(2),
    attributionMonths: Number(draft.attributionMonths),
    factoryQualifyJobs: Number(draft.factoryQualifyJobs),
    factoryQualifyDays: Number(draft.factoryQualifyDays),
  };
}

/** The plan figures as inputs. */
function TermsFields({ draft, onChange }: { draft: TermsDraft; onChange: (draft: TermsDraft) => void }) {
  const t = useTranslations("agents.terms");
  const field = (name: keyof TermsDraft, suffix?: string) => (
    <Field label={t(name)} hint={suffix}>
      <Input
        inputMode="decimal"
        value={draft[name]}
        onChange={(event) => onChange({ ...draft, [name]: event.target.value })}
      />
    </Field>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("firstOrderPct", t("pctHint"))}
      {field("repeatOrderPct", t("pctHint"))}
      {field("attributionMonths")}
      {field("marginCapPct", t("capHint"))}
      {field("minBaseAmount")}
      {field("factoryBountyAmount", t("bountyHint"))}
      {field("factoryQualifyJobs")}
      {field("factoryQualifyDays")}
    </div>
  );
}

/**
 * Commission plans (D-418): what an agent earns, as a dated series of versions. Every change is a
 * new version that someone other than its author approves; an agent's order is paid under the
 * version in force when the order was placed.
 */
export function PlansList() {
  const t = useTranslations("agents.plans");
  const format = useFormat();
  const plans = usePlans();
  const canManage = useCan("agent_plans.manage");
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<AgentPlan>[] = [
    {
      id: "name",
      header: t("columns.plan"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/agents/plans/${row.id}`} className="text-primary font-medium hover:underline">
            {row.nameTh}
          </Link>
          <span className="text-muted text-xs tabular-nums">{row.code}</span>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => <KindBadge kind={row.agentKind} /> },
    {
      id: "rates",
      header: t("columns.rates"),
      cell: (row) =>
        row.current
          ? t("rates", {
              first: format.percent(row.current.firstOrderPct),
              repeat: format.percent(row.current.repeatOrderPct),
              months: row.current.attributionMonths,
            })
          : "–",
    },
    { id: "agents", header: t("columns.agents"), numeric: true, cell: (row) => format.number(row.agentCount) },
    {
      id: "state",
      header: t("columns.state"),
      cell: (row) => {
        const pending = row.versions.filter((version) => version.status === "draft").length;
        return row.retiredAt ? (
          <Badge size="sm" icon="archive">
            {t("retired")}
          </Badge>
        ) : pending ? (
          <Badge size="sm" tone="warning" icon="stamp">
            {t("pending", { count: pending })}
          </Badge>
        ) : (
          <Badge size="sm" tone="success" icon="check">
            {t("inForce")}
          </Badge>
        );
      },
    },
  ];

  if (plans.isError) return <QueryError error={plans.error} onRetry={() => void plans.refetch()} />;
  return (
    <Section
      title={t("listTitle")}
      actions={
        canManage ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={plans.data ?? []}
        getRowId={(row) => row.id}
        loading={plans.isPending}
        empty={<EmptyState icon="percent" title={t("empty")} />}
      />
      {creating ? <CreatePlanDialog onClose={() => setCreating(false)} /> : null}
    </Section>
  );
}

function CreatePlanDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents.createPlan");
  const tTerms = useTranslations("agents.terms");
  const tKinds = useTranslations("agents.kinds");
  const router = useRouter();
  const refresh = useRefreshAgents();
  const [kind, setKind] = useState<AgentKind>("freelance");
  const [form, setForm] = useState({ code: "", nameTh: "", nameEn: "", description: "", reason: "" });
  const [terms, setTerms] = useState<TermsDraft>(BLANK);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: event.target.value });
  return (
    <FormDialog
      size="lg"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(form.code)) throw new FormError(t("needCode"));
        if (form.nameTh.trim().length < 2) throw new FormError(t("needName"));
        if (form.reason.trim().length < 3) throw new FormError(t("needReason"));
        const figures = parseTerms(terms, tTerms);
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/agent-plans", {
          body: {
            agentKind: kind,
            code: form.code,
            nameTh: form.nameTh.trim(),
            nameEn: form.nameEn.trim() || null,
            description: form.description.trim() || null,
            reason: form.reason.trim(),
            ...figures,
          },
        });
        refresh();
        toast.success(t("done"));
        router.push(`/agents/plans/${data!.id}`);
      }}
    >
      <SegmentedControl
        label={t("kind")}
        value={kind}
        onValueChange={(value) => setKind(value as AgentKind)}
        options={(["freelance", "employee"] as const).map((value) => ({ value, label: tKinds(value) }))}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("code")} hint={t("codeHint")} required>
          <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} />
        </Field>
        <Field label={t("nameTh")} required>
          <Input value={form.nameTh} onChange={set("nameTh")} />
        </Field>
        <Field label={t("nameEn")}>
          <Input value={form.nameEn} onChange={set("nameEn")} />
        </Field>
      </div>
      <Field label={t("description")}>
        <Textarea rows={2} value={form.description} onChange={set("description")} />
      </Field>
      <TermsFields draft={terms} onChange={setTerms} />
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Input value={form.reason} onChange={set("reason")} />
      </Field>
    </FormDialog>
  );
}

/**
 * One plan (D-418): the terms in force, every version with who proposed and who decided it, and a
 * new version to propose. A proposal waits for someone else with `agent_plans.approve`; it takes
 * effect on its date — never earlier than the day it is approved.
 */
export function PlanDetail({ planId }: { planId: string }) {
  const t = useTranslations("agents.plan");
  const tTerms = useTranslations("agents.terms");
  const format = useFormat();
  const actor = useActor();
  const queryClient = useQueryClient();
  const refresh = useRefreshAgents();
  const canManage = useCan("agent_plans.manage");
  const canApprove = useCan("agent_plans.approve");
  const key = queryKeys.detail("admin", "agent_plan", planId);
  const [drafting, setDrafting] = useState(false);
  const [terms, setTerms] = useState<TermsDraft>(BLANK);
  const [effectiveFrom, setEffectiveFrom] = useState(bangkokToday());
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState<{ version: AgentPlanVersion; decision: "approve" | "reject" } | null>(null);
  const [retiring, setRetiring] = useState(false);

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/agent-plans/{planId}", { params: { path: { planId } } })).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const plan = query.data;
  if (!plan) return null;

  const settle = (updated: AgentPlan) => {
    queryClient.setQueryData(key, updated);
    refresh();
  };
  const hasDraft = plan.versions.some((version) => version.status === "draft");

  const columns: DataTableColumn<AgentPlanVersion>[] = [
    {
      id: "versionNo",
      header: t("columns.version"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          {t("versionNo", { no: row.versionNo })}
          {row.inForce ? (
            <Badge size="sm" tone="success">
              {t("inForce")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_PLAN_VERSION_STATUS} value={row.status} />,
    },
    { id: "effectiveFrom", header: t("columns.from"), cell: (row) => format.date(row.effectiveFrom) },
    {
      id: "rates",
      header: t("columns.rates"),
      cell: (row) => (
        <span className="text-sm">
          {t("rates", {
            first: format.percent(row.firstOrderPct),
            repeat: format.percent(row.repeatOrderPct),
            cap: format.percent(row.marginCapPct),
            months: row.attributionMonths,
          })}
          {Number(row.factoryBountyAmount) > 0 ? (
            <span className="text-muted block text-xs">
              {tTerms("bountyValue", {
                amount: format.thb(row.factoryBountyAmount),
                jobs: row.factoryQualifyJobs,
                days: row.factoryQualifyDays,
              })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "who",
      header: t("columns.who"),
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span>{t("proposedBy", { name: row.createdBy?.displayName ?? "–" })}</span>
          {row.decidedBy ? (
            <span className="text-muted">
              {t("decidedBy", {
                name: row.decidedBy.displayName,
                date: row.decidedAt ? format.date(row.decidedAt) : "",
              })}
            </span>
          ) : null}
          <span className="text-muted">{row.reason}</span>
          {row.decisionNote ? <span className="text-muted">{row.decisionNote}</span> : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        row.status === "draft" && canApprove ? (
          row.createdBy?.id === actor.id ? (
            <span className="text-muted text-xs">{t("ownProposal")}</span>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => setDeciding({ version: row, decision: "approve" })}>
                {t("approve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeciding({ version: row, decision: "reject" })}>
                {t("reject")}
              </Button>
            </div>
          )
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("plans"), href: "/agents/plans" }, { label: plan.code }]}
          />
        }
        title={plan.nameTh}
        meta={
          <>
            <span className="text-muted text-sm tabular-nums">{plan.code}</span>
            <KindBadge kind={plan.agentKind} />
            {plan.retiredAt ? <Badge icon="archive">{t("retired")}</Badge> : null}
            <span className="text-muted text-sm">{t("agents", { count: plan.agentCount })}</span>
          </>
        }
        description={plan.description ?? undefined}
        actions={
          canManage && !plan.retiredAt ? (
            <>
              <Button
                variant="ghost"
                disabled={plan.agentCount > 0}
                title={plan.agentCount > 0 ? t("retireInUse") : undefined}
                onClick={() => setRetiring(true)}
              >
                {t("retire")}
              </Button>
              <Button
                iconStart="edit"
                disabled={hasDraft}
                onClick={() => {
                  setTerms(plan.current ? termsOf(plan.current) : BLANK);
                  setEffectiveFrom(bangkokToday());
                  setReason("");
                  setDrafting(true);
                }}
              >
                {t("propose")}
              </Button>
            </>
          ) : null
        }
      />
      {hasDraft ? (
        <Callout tone="warning" title={t("draftWaiting")}>
          {t("draftWaitingBody")}
        </Callout>
      ) : null}

      <Section title={t("current")}>
        {plan.current ? <TermsList terms={plan.current} /> : <p className="text-muted text-sm">{t("noCurrent")}</p>}
      </Section>
      <Section title={t("versions")}>
        <DataTable caption={t("versions")} columns={columns} rows={plan.versions} getRowId={(row) => row.id} />
      </Section>

      {drafting ? (
        <FormDialog
          size="lg"
          title={t("proposeTitle")}
          description={t("proposeBody")}
          submitLabel={t("proposeSubmit")}
          onClose={() => setDrafting(false)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            const figures = parseTerms(terms, tTerms);
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/agent-plans/{planId}/versions", {
              params: { path: { planId } },
              // Today means now (a start earlier today would be backdated); a later day starts at Bangkok midnight.
              body: {
                ...figures,
                effectiveFrom:
                  effectiveFrom <= bangkokToday() ? new Date().toISOString() : `${effectiveFrom}T00:00:00+07:00`,
                reason: reason.trim(),
              },
            });
            settle(data!);
            toast.success(t("proposed"));
          }}
        >
          <TermsFields draft={terms} onChange={setTerms} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} required>
              <Input
                type="date"
                min={bangkokToday()}
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </Field>
            <Field label={t("reason")} required>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        </FormDialog>
      ) : null}

      {deciding ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setDeciding(null))}
          title={t(`${deciding.decision}Title`, { no: deciding.version.versionNo })}
          description={t(`${deciding.decision}Body`, {
            no: deciding.version.versionNo,
            date: format.date(deciding.version.effectiveFrom),
            count: plan.agentCount,
          })}
          confirmLabel={t(deciding.decision)}
          tone={deciding.decision === "reject" ? "destructive" : "primary"}
          reason={deciding.decision === "reject" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
          onConfirm={async ({ reason: note }) => {
            try {
              const api = adminBrowserApis().contract;
              const path = { versionId: deciding.version.id };
              const { data } =
                deciding.decision === "approve"
                  ? await api.POST("/v1/admin/agent-plans/versions/{versionId}/actions/approve", { params: { path } })
                  : await api.POST("/v1/admin/agent-plans/versions/{versionId}/actions/reject", {
                      params: { path },
                      body: { reason: note },
                    });
              settle(data!);
              toast.success(t("decided"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}

      <ConfirmAction
        open={retiring}
        onOpenChange={setRetiring}
        title={t("retireTitle")}
        description={t("retireBody", { name: plan.nameTh })}
        confirmLabel={t("retire")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason: why }) => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/agent-plans/{planId}/actions/retire", {
              params: { path: { planId } },
              body: { reason: why },
            });
            settle(data!);
            toast.success(t("retiredDone"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
