"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_COMMISSION_STATUS, AGENT_STATEMENT_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Stat } from "@/ui/components/Stat";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  QueueTabs,
  ResourceList,
  Section,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { CommissionWhat } from "./Commissions";
import {
  AGENT_KINDS,
  STATEMENT_STATUSES,
  statementsList,
  type AgentCommission,
  type AgentStatement,
  type AgentStatementDetail,
} from "./resources";
import { AgentCell, bangkokToday, previousMonth, useRefreshAgents } from "./shared";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Monthly statements (D-420): one per agent with earned lines, generated for a closed month.
 * A freelance statement, once approved, is a vendor bill paid by the next payout run with
 * ภ.ง.ด.1 withholding; an employee statement is accrued and goes to payroll as a CSV.
 */
export function StatementsList({ initial }: { initial: InitialPage<AgentStatement> | null }) {
  const t = useTranslations("agents.statements");
  const tStatus = useTranslations("status");
  const tKinds = useTranslations("agents.kinds");
  const format = useFormat();
  const canApprove = useCan("agent_statements.approve");
  const [dialog, setDialog] = useState<"generate" | "export" | null>(null);

  const columns: DataTableColumn<AgentStatement>[] = [
    {
      id: "statementNo",
      header: t("columns.no"),
      cell: (row) => (
        <Link href={`/agents/statements/${row.id}`} className="text-primary tabular-nums hover:underline">
          {row.statementNo}
        </Link>
      ),
    },
    { id: "agent", header: t("columns.agent"), cell: (row) => <AgentCell agent={row.agent} /> },
    { id: "period", header: t("columns.period"), cell: (row) => format.date(row.periodStart, { style: "month" }) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_STATEMENT_STATUS} value={row.status} />,
    },
    { id: "lines", header: t("columns.lines"), numeric: true, cell: (row) => format.number(row.entryCount) },
    { id: "total", header: t("columns.total"), numeric: true, cell: (row) => format.thb(row.totalAmount) },
    {
      id: "wht",
      header: t("columns.wht"),
      numeric: true,
      hideable: true,
      cell: (row) => (row.whtAmount ? format.thb(row.whtAmount) : "–"),
    },
    {
      id: "paid",
      header: t("columns.paid"),
      numeric: true,
      cell: (row) => (row.paidAmount ? format.thb(row.paidAmount) : "–"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...STATEMENT_STATUSES.map((status) => ({
            value: status,
            label: tStatus(AGENT_STATEMENT_STATUS[status].labelKey),
          })),
        ]}
      />
      <ResourceList
        resource={statementsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowHref={(row) => `/agents/statements/${row.id}`}
        rowTone={(row) => (row.status === "draft" ? "warning" : undefined)}
        filters={[
          { id: "period", label: t("columns.period"), kind: "text", placeholder: "2026-09" },
          {
            id: "kind",
            label: t("columns.kind"),
            kind: "select",
            options: AGENT_KINDS.map((kind) => ({ value: kind, label: tKinds(kind) })),
          },
        ]}
        toolbarEnd={
          canApprove ? (
            <>
              <Button variant="secondary" iconStart="spreadsheet" onClick={() => setDialog("export")}>
                {t("exportPayroll")}
              </Button>
              <Button iconStart="refresh" onClick={() => setDialog("generate")}>
                {t("generate")}
              </Button>
            </>
          ) : null
        }
        empty={{ title: t("empty"), description: t("emptyHint") }}
      />
      {dialog ? <MonthDialog action={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

/** Generating a month's statements, or exporting a month's approved employee statements for payroll. */
function MonthDialog({ action, onClose }: { action: "generate" | "export"; onClose: () => void }) {
  const tGenerate = useTranslations("agents.generate");
  const tPayroll = useTranslations("agents.payroll");
  const copy = action === "generate" ? tGenerate : tPayroll;
  const refresh = useRefreshAgents();
  const [period, setPeriod] = useState(previousMonth());
  return (
    <FormDialog
      title={copy("title")}
      description={copy("body")}
      submitLabel={copy("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!MONTH.test(period)) throw new FormError(copy("needMonth"));
        const api = adminBrowserApis().contract;
        if (action === "generate") {
          const { data } = await api.POST("/v1/admin/agent-statements/actions/generate", { body: { period } });
          toast.success(copy("done", { created: data!.created, carried: data!.carriedForward }));
        } else {
          const { data } = await api.POST("/v1/admin/agent-statements/actions/export-payroll", { body: { period } });
          window.open(data!.url, "_blank", "noopener");
          toast.success(copy("done", { count: data!.statements }));
        }
        refresh();
      }}
    >
      <Field label={copy("month")} hint={copy("monthHint")} required>
        <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

/** Reads the statement with its ETag: approving is sent under `If-Match`. */
async function readStatement(statementId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/agent-statements/{statementId}", {
    params: { path: { statementId } },
  });
  return { data: data!, etag: response.headers.get("ETag") };
}

type StatementAction = "approve" | "void" | "markPaid";

/**
 * One statement (D-420): its lines and totals, and the step it is waiting for — approval (which
 * books it), payment (by payout run for a freelance agent, recorded here for payroll), or nothing.
 * A draft can be voided; its lines return to earned for the next run.
 */
export function StatementDetail({ statementId }: { statementId: string }) {
  const t = useTranslations("agents.statement");
  const format = useFormat();
  const queryClient = useQueryClient();
  const refresh = useRefreshAgents();
  const canApprove = useCan("agent_statements.approve");
  const key = queryKeys.detail("admin", "agent_statement", statementId);
  const [action, setAction] = useState<StatementAction | null>(null);
  const [paidOn, setPaidOn] = useState(bangkokToday());

  const query = useQuery({ queryKey: key, queryFn: async () => (await readStatement(statementId)).data });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const s: AgentStatementDetail | undefined = query.data;
  if (!s) return null;

  const employee = s.agent.kind === "employee";
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    refresh();
  };
  const actions: StatementAction[] = !canApprove
    ? []
    : s.status === "draft"
      ? ["approve", "void"]
      : employee && (s.status === "approved" || s.status === "exported")
        ? ["markPaid"]
        : [];

  const columns: DataTableColumn<AgentCommission>[] = [
    { id: "what", header: t("columns.what"), cell: (row) => <CommissionWhat row={row} /> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_COMMISSION_STATUS} value={row.status} />,
    },
    { id: "earnedAt", header: t("columns.earned"), cell: (row) => (row.earnedAt ? format.date(row.earnedAt) : "–") },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.amount) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("statements"), href: "/agents/statements" }, { label: s.statementNo }]}
          />
        }
        title={s.statementNo}
        meta={
          <>
            <StatusChip map={AGENT_STATEMENT_STATUS} value={s.status} size="md" />
            <span className="text-muted text-sm">{format.date(s.periodStart, { style: "month" })}</span>
          </>
        }
        description={
          <span>
            <Link href={`/agents/${s.agent.id}`} className="text-primary hover:underline">
              {s.agent.legalName}
            </Link>{" "}
            · <span className="tabular-nums">{s.agent.code}</span>
          </span>
        }
        actions={actions.map((item) => (
          <Button
            key={item}
            variant={item === "void" ? "ghost" : "primary"}
            iconStart={item === "approve" ? "stamp" : item === "markPaid" ? "wallet" : undefined}
            onClick={() => setAction(item)}
          >
            {t(`actions.${item}.label`)}
          </Button>
        ))}
      />

      {s.status === "voided" && s.voidReason ? (
        <Callout tone="info" title={t("voided")}>
          {s.voidReason}
        </Callout>
      ) : null}
      {s.status === "approved" && !employee ? (
        <Callout tone="info" title={t("awaitingPayout")}>
          {t("awaitingPayoutBody")}
        </Callout>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("total")} value={format.thb(s.totalAmount)} />
        <Stat label={t("wht")} value={s.whtAmount ? format.thb(s.whtAmount) : employee ? t("viaPayroll") : "–"} />
        <Stat
          label={t("paid")}
          value={s.paidAmount ? format.thb(s.paidAmount) : "–"}
          tone={s.paidAt ? "success" : "neutral"}
        />
        <Stat label={t("lines")} value={format.number(s.entryCount)} />
      </div>

      <Section title={t("timeline")}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {(
            [
              [
                t("approvedAt"),
                s.approvedAt
                  ? `${format.dateTime(s.approvedAt)}${s.approvedBy ? ` · ${s.approvedBy.displayName}` : ""}`
                  : "–",
              ],
              [t("exportedAt"), s.exportedAt ? format.dateTime(s.exportedAt) : "–"],
              [t("paidAt"), s.paidAt ? format.date(s.paidAt) : "–"],
            ] as const
          ).map(([term, value]) => (
            <div key={term} className="flex flex-col">
              <dt className="text-muted text-xs">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {s.vendorInvoiceId ? (
          <p className="mt-3 text-sm">
            <Link href={`/finance/payables/invoices/${s.vendorInvoiceId}`} className="text-primary hover:underline">
              {t("openBill")}
            </Link>
          </p>
        ) : null}
      </Section>

      <Section title={t("entries")}>
        <DataTable
          caption={t("entries")}
          columns={columns}
          rows={s.entries}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="coins" title={t("noEntries")} />}
        />
      </Section>

      {action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body${action === "approve" ? (employee ? "Employee" : "Freelance") : ""}`, {
            no: s.statementNo,
            amount: format.thb(s.totalAmount),
            agent: s.agent.legalName,
          })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={action === "void" ? "destructive" : "primary"}
          confirmationPhrase={action === "approve" ? s.statementNo : undefined}
          reason={action === "void" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const api = adminBrowserApis().contract;
              const path = { statementId };
              if (action === "approve") {
                const { etag } = await readStatement(statementId);
                await api.POST("/v1/admin/agent-statements/{statementId}/actions/approve", {
                  params: { path, header: { "If-Match": etag ?? "", "Idempotency-Key": idempotencyKey } },
                });
              } else if (action === "void") {
                await api.POST("/v1/admin/agent-statements/{statementId}/actions/void", {
                  params: { path },
                  body: { reason },
                });
              } else {
                await api.POST("/v1/admin/agent-statements/{statementId}/actions/mark-paid", {
                  params: { path },
                  body: { paidOn },
                });
              }
              settle();
              toast.success(t(`actions.${action}.done`));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        >
          {action === "markPaid" ? (
            <Field label={t("paidOn")} required>
              <Input
                type="date"
                value={paidOn}
                max={bangkokToday()}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </Field>
          ) : null}
        </ConfirmAction>
      ) : null}
    </div>
  );
}
