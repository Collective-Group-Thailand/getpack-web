"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_COMMISSION_STATUS, AGENT_LINK_STATUS, AGENT_STATEMENT_STATUS, AGENT_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { StatsRow } from "@/ui/components/DeskPage";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Row, RowList } from "@/ui/components/RowList";
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
  useCan,
} from "../console";
import { DetailSkeleton } from "../console/DetailSkeleton";
import type { Agent, AgentCommission, AgentLink, AgentStatement } from "./resources";
import { KindBadge, planOptions, TermsList, usePlans, useRefreshAgents } from "./shared";

/** Reads the agent with its ETag: an edit is sent under `If-Match` (`admin.agents.update`). */
async function readAgent(agentId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/agents/{agentId}", {
    params: { path: { agentId } },
  });
  return { data: data!, etag: response.headers.get("ETag") };
}

type StatusAction = "suspend" | "reactivate" | "end";
const ACTION_ORDER: readonly StatusAction[] = ["reactivate", "suspend", "end"];

/**
 * One agent (D-416 – D-420): who they are, their link, what they are owed and why, the plan they
 * are on, and the customers, commissions and statements behind the totals. Suspending stops new
 * attribution and accrual; ending also ends their links, leads and factory links, and cannot be
 * undone.
 */
export function AgentDetail({ agentId }: { agentId: string }) {
  const t = useTranslations("agents.agent");
  const tJuristic = useTranslations("agents.juristic");
  const format = useFormat();
  const queryClient = useQueryClient();
  const refresh = useRefreshAgents();
  const canManage = useCan("agents.manage");
  const plans = usePlans();
  const key = queryKeys.detail("admin", "agent", agentId);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ planId: "", employeeCode: "", note: "", reason: "" });

  const query = useQuery({ queryKey: key, queryFn: async () => (await readAgent(agentId)).data });
  const api = adminBrowserApis().contract;
  const recent = { agentId, perPage: 10 };
  const commissions = useQuery({
    queryKey: queryKeys.list("admin", "agent_commission", recent),
    queryFn: async () => (await api.GET("/v1/admin/agent-commissions", { params: { query: recent } })).data!,
  });
  const links = useQuery({
    queryKey: queryKeys.list("admin", "agent_link", { ...recent, status: "active" }),
    queryFn: async () =>
      (await api.GET("/v1/admin/agent-links", { params: { query: { ...recent, status: "active" } } })).data!,
  });
  const statements = useQuery({
    queryKey: queryKeys.list("admin", "agent_statement", recent),
    queryFn: async () => (await api.GET("/v1/admin/agent-statements", { params: { query: recent } })).data!,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const agent = query.data;
  if (!agent) return <DetailSkeleton />;

  const settle = (updated: Agent) => {
    queryClient.setQueryData(key, updated);
    refresh();
  };
  const ended = agent.status === "ended";
  const actions: StatusAction[] = ended ? [] : agent.status === "active" ? ["suspend", "end"] : ["reactivate", "end"];
  const options = planOptions(plans.data, agent.kind);
  const { totals } = agent;

  const linkColumns: DataTableColumn<AgentLink>[] = [
    {
      id: "name",
      header: t("links.name"),
      cell: (row) =>
        row.customer ? (
          <Link href={`/customers/${row.customer.id}`} className="text-primary hover:underline">
            {row.name}
          </Link>
        ) : row.companyId ? (
          <Link href={`/companies/${row.companyId}`} className="text-primary hover:underline">
            {row.name}
          </Link>
        ) : (
          row.name
        ),
    },
    { id: "source", header: t("links.source"), cell: (row) => t(`sources.${row.source}`) },
    {
      id: "status",
      header: t("links.status"),
      cell: (row) => <StatusChip map={AGENT_LINK_STATUS} value={row.status} />,
    },
    { id: "orders", header: t("links.orders"), numeric: true, cell: (row) => format.number(row.orders) },
    { id: "commission", header: t("links.commission"), numeric: true, cell: (row) => format.thb(row.commission) },
    { id: "endsAt", header: t("links.until"), cell: (row) => format.date(row.endsAt) },
  ];
  const commissionColumns: DataTableColumn<AgentCommission>[] = [
    {
      id: "what",
      header: t("commissions.what"),
      cell: (row) => (
        <div className="flex flex-col">
          <span>{t(`commissionKinds.${row.kind}`)}</span>
          <span className="text-muted text-xs">
            {row.orderCode ?? row.factoryName ?? row.note ?? ""}
            {row.customerName ? ` · ${row.customerName}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("commissions.status"),
      cell: (row) => <StatusChip map={AGENT_COMMISSION_STATUS} value={row.status} />,
    },
    { id: "amount", header: t("commissions.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    { id: "createdAt", header: t("commissions.date"), cell: (row) => <When at={row.createdAt} /> },
  ];
  const statementColumns: DataTableColumn<AgentStatement>[] = [
    {
      id: "no",
      header: t("statements.no"),
      cell: (row) => (
        <Link href={`/agents/statements/${row.id}`} className="text-primary tabular-nums hover:underline">
          {row.statementNo}
        </Link>
      ),
    },
    {
      id: "status",
      header: t("statements.status"),
      cell: (row) => <StatusChip map={AGENT_STATEMENT_STATUS} value={row.status} />,
    },
    { id: "total", header: t("statements.total"), numeric: true, cell: (row) => format.thb(row.totalAmount) },
    { id: "period", header: t("statements.period"), cell: (row) => format.date(row.periodStart, { style: "month" }) },
  ];

  const facts: [string, React.ReactNode][] = [
    [t("legalName"), agent.legalName],
    [t("juristicType"), tJuristic(agent.juristicType)],
    [
      t("taxId"),
      agent.taxId ? (
        <span key="taxId" className="tabular-nums">
          {agent.taxId}
        </span>
      ) : (
        "–"
      ),
    ],
    [
      t("account"),
      <Link key="account" href={`/customers/${agent.user.id}`} className="text-primary hover:underline">
        {agent.user.displayName}
      </Link>,
    ],
    [t("phone"), agent.phone ?? "–"],
    [t("joined"), format.date(agent.joinedAt)],
    ...(agent.kind === "employee"
      ? ([
          [t("employeeCode"), agent.employeeCode ?? "–"],
          [t("staffUser"), agent.staffUser?.displayName ?? "–"],
        ] as [string, React.ReactNode][])
      : ([[t("bankAccount"), t(`bankStates.${agent.bankAccount}`)]] as [string, React.ReactNode][])),
    [
      t("link"),
      <span key="link" className="break-all">
        {agent.link}
      </span>,
    ],
  ];

  const startEdit = () => {
    setDraft({
      planId: agent.plan.id,
      employeeCode: agent.employeeCode ?? "",
      note: agent.note ?? "",
      reason: "",
    });
    setEditing(true);
  };
  // The panel's steps: bringing a suspended agent back is the one filled step; edits and a suspension are outlined,
  // ending (which cannot be undone) comes last.
  const ordered = [...actions].sort((x, y) => ACTION_ORDER.indexOf(x) - ACTION_ORDER.indexOf(y));

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageHeader
        back={{ href: "/agents", label: t("agents") }}
        title={agent.legalName}
        meta={
          <>
            <span className="text-muted text-sm tabular-nums">{agent.code}</span>
            <KindBadge kind={agent.kind} />
            <StatusChip map={AGENT_STATUS} value={agent.status} size="md" />
          </>
        }
      />

      <DetailLayout
        aside={
          <ActionPanel id="agent-panel" tone="neutral" title={t("panelTitle")}>
            {canManage && (!ended || ordered.length > 0) ? (
              <div data-fill="row" className="flex flex-col gap-2">
                {ordered
                  .filter((item) => item === "reactivate")
                  .map((item) => (
                    <Button key={item} onClick={() => setAction(item)}>
                      {t(`actions.${item}.label`)}
                    </Button>
                  ))}
                {!ended ? (
                  <Button variant="secondary" iconStart="edit" onClick={startEdit}>
                    {t("edit")}
                  </Button>
                ) : null}
                {ordered
                  .filter((item) => item !== "reactivate")
                  .map((item) => (
                    <Button
                      key={item}
                      variant={item === "end" ? "ghost" : "secondary"}
                      className={item === "end" ? "text-danger" : undefined}
                      onClick={() => setAction(item)}
                    >
                      {t(`actions.${item}.label`)}
                    </Button>
                  ))}
              </div>
            ) : null}
            <RowList label={t("panelTitle")} className="-mx-1">
              <Row
                href={`/agents/commissions?agentId=${agent.id}&status=held`}
                icon="shield-alert"
                tone={Number(totals.held) > 0 ? "warning" : "neutral"}
                title={t("totals.held")}
                aside={format.thb(totals.held)}
              />
              <Row
                href={`/agents/links?agentId=${agent.id}`}
                icon="users"
                title={t("totals.customers")}
                aside={format.number(totals.activeLinks)}
              />
              <Row
                href={`/agents/leads?agentId=${agent.id}`}
                icon="shield"
                title={t("totals.leads")}
                aside={format.number(totals.openLeads)}
              />
              <Row
                href={`/agents/factories?agentId=${agent.id}`}
                icon="factory"
                title={t("totals.factories")}
                aside={format.number(totals.factories)}
              />
            </RowList>
          </ActionPanel>
        }
      >
        {agent.status !== "active" && agent.statusReason ? (
          <Callout tone={agent.status === "suspended" ? "warning" : "info"} title={t(`statusNote.${agent.status}`)}>
            {agent.statusReason}
          </Callout>
        ) : null}
        {agent.kind === "freelance" && agent.bankAccount !== "active" && !ended ? (
          <Callout tone="warning" title={t(`bankWarning.${agent.bankAccount}`)}>
            {t("bankWarningBody")}
          </Callout>
        ) : null}

        <StatsRow
          label={t("totalsLabel")}
          columns={4}
          items={[
            {
              key: "pending",
              label: t("totals.pending"),
              value: format.thb(totals.pending),
              hint: t("totals.pendingHint"),
            },
            {
              key: "earned",
              label: t("totals.earned"),
              value: format.thb(totals.earned),
              hint: t("totals.earnedHint"),
              highlight: true,
            },
            { key: "statemented", label: t("totals.statemented"), value: format.thb(totals.statemented) },
            { key: "paidThisYear", label: t("totals.paidThisYear"), value: format.thb(totals.paidThisYear) },
          ]}
        />

        <Section title={t("profile")}>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map(([term, value]) => (
              <div key={term} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-muted text-xs">{term}</dt>
                <dd className="[overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          {agent.note ? <p className="text-muted mt-3 text-sm whitespace-pre-line">{agent.note}</p> : null}
        </Section>
        <Section
          title={t("plan", { name: agent.plan.nameTh })}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/agents/plans/${agent.plan.id}`}>{t("openPlan")}</Link>
            </Button>
          }
        >
          {agent.terms ? <TermsList terms={agent.terms} /> : <p className="text-muted text-sm">{t("noTerms")}</p>}
        </Section>

        <Section
          title={t("commissions.title")}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/agents/commissions?agentId=${agent.id}`}>{t("viewAll")}</Link>
            </Button>
          }
        >
          <DataTable
            caption={t("commissions.title")}
            columns={commissionColumns}
            rows={commissions.data?.data ?? []}
            getRowId={(row) => row.id}
            loading={commissions.isPending}
            empty={<EmptyState icon="coins" title={t("commissions.empty")} />}
          />
        </Section>
        <Section
          title={t("links.title")}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/agents/links?agentId=${agent.id}`}>{t("viewAll")}</Link>
            </Button>
          }
        >
          <DataTable
            caption={t("links.title")}
            columns={linkColumns}
            rows={links.data?.data ?? []}
            getRowId={(row) => row.id}
            loading={links.isPending}
            empty={<EmptyState icon="users" title={t("links.empty")} />}
          />
        </Section>
        <Section
          title={t("statements.title")}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/agents/statements?agentId=${agent.id}`}>{t("viewAll")}</Link>
            </Button>
          }
        >
          <DataTable
            caption={t("statements.title")}
            columns={statementColumns}
            rows={statements.data?.data ?? []}
            getRowId={(row) => row.id}
            loading={statements.isPending}
            empty={<EmptyState icon="document" title={t("statements.empty")} />}
          />
        </Section>
      </DetailLayout>

      {action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, { name: agent.legalName, code: agent.code })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={action === "reactivate" ? "primary" : "destructive"}
          confirmationPhrase={action === "end" ? agent.code : undefined}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              const init = { params: { path: { agentId } }, body: { reason } };
              const { data } =
                action === "suspend"
                  ? await api.POST("/v1/admin/agents/{agentId}/actions/suspend", init)
                  : action === "reactivate"
                    ? await api.POST("/v1/admin/agents/{agentId}/actions/reactivate", init)
                    : await api.POST("/v1/admin/agents/{agentId}/actions/end", init);
              settle(data!);
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}

      {editing ? (
        <FormDialog
          title={t("editTitle")}
          description={t("editBody", { code: agent.code })}
          submitLabel={t("save")}
          onClose={() => setEditing(false)}
          onSubmit={async () => {
            const planChanged = draft.planId !== agent.plan.id;
            if (planChanged && draft.reason.trim().length < 3) throw new FormError(t("needReason"));
            const { etag } = await readAgent(agentId);
            const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/agents/{agentId}", {
              params: { path: { agentId }, header: { "If-Match": etag ?? "" } },
              body: {
                ...(planChanged ? { planId: draft.planId, reason: draft.reason.trim() } : {}),
                note: draft.note.trim() || null,
                ...(agent.kind === "employee" ? { employeeCode: draft.employeeCode.trim() } : {}),
              },
            });
            settle(data!);
            toast.success(t("saved"));
          }}
        >
          <Field label={t("planField")} hint={t("planHint")}>
            <SearchableSelect
              value={draft.planId}
              onValueChange={(planId) => setDraft({ ...draft, planId })}
              options={
                options.some((o) => o.value === agent.plan.id)
                  ? options
                  : [{ value: agent.plan.id, label: agent.plan.nameTh }, ...options]
              }
            />
          </Field>
          {draft.planId !== agent.plan.id ? (
            <Field label={t("reason")} required>
              <Input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            </Field>
          ) : null}
          {agent.kind === "employee" ? (
            <Field label={t("employeeCode")} required>
              <Input
                value={draft.employeeCode}
                onChange={(event) => setDraft({ ...draft, employeeCode: event.target.value })}
              />
            </Field>
          ) : null}
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea
              rows={3}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
