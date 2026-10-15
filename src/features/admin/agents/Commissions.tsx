"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_COMMISSION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { ComboboxOption } from "@/ui/components/Combobox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { RecordPicker } from "./Pickers";
import { COMMISSION_KINDS, COMMISSION_STATUSES, commissionsList, type AgentCommission } from "./resources";
import { AgentCell, useRefreshAgents } from "./shared";

/** What a commission line is for, and how it was worked out. */
export function CommissionWhat({ row }: { row: AgentCommission }) {
  const t = useTranslations("agents.commissions");
  const format = useFormat();
  const subject =
    row.kind === "order" || row.kind === "reversal" ? (
      row.orderId && row.orderCode ? (
        <Link href={`/orders/${row.orderId}`} className="text-primary font-mono hover:underline">
          {row.orderCode}
        </Link>
      ) : null
    ) : row.kind === "factory_bounty" ? (
      row.factoryName
    ) : null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        {t(`kinds.${row.kind}`)}
        {subject ? <span>· {subject}</span> : null}
        {row.kind === "order" && row.isFirstOrder ? (
          <Badge size="sm" tone="primary">
            {t("first")}
          </Badge>
        ) : null}
      </span>
      {row.customerName ? <span className="text-muted text-xs">{row.customerName}</span> : null}
      {row.ratePct ? (
        <span className="text-muted text-xs">
          {t("basis", { rate: format.percent(row.ratePct), base: format.thb(row.baseAmount) })}
          {row.capAmount ? ` · ${t("capped", { cap: format.thb(row.capAmount) })}` : ""}
        </span>
      ) : null}
      {row.note ? <span className="text-muted text-xs">{row.note}</span> : null}
    </div>
  );
}

/**
 * Every commission line (D-418, D-419): order commission pending until the claim window passes and
 * the order is paid in full, then earned; bounties, adjustments and reversals; lines held because
 * the agent shares an identity with the buyer, for Sales to release or cancel.
 */
export function CommissionsList({ initial }: { initial: InitialPage<AgentCommission> | null }) {
  const t = useTranslations("agents.commissions");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canDecide = useCan("agents.manage");
  const canAdjust = useCan("agent_commissions.adjust");
  const [adjusting, setAdjusting] = useState(false);
  const [deciding, setDeciding] = useState<{ row: AgentCommission; decision: "release" | "cancel" } | null>(null);
  const refresh = useRefreshAgents();

  const columns: DataTableColumn<AgentCommission>[] = [
    { id: "what", header: t("columns.what"), cell: (row) => <CommissionWhat row={row} /> },
    { id: "agent", header: t("columns.agent"), cell: (row) => <AgentCell agent={row.agent} /> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusChip map={AGENT_COMMISSION_STATUS} value={row.status} />
          {row.holdFlags.length ? (
            <span className="text-warning-subtle-fg text-xs">
              {row.holdFlags.map((flag) => (t.has(`flags.${flag}`) ? t(`flags.${flag}`) : flag)).join(", ")}
            </span>
          ) : null}
          {row.statementNo ? <span className="text-muted font-mono text-xs">{row.statementNo}</span> : null}
        </div>
      ),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      numeric: true,
      cell: (row) => (
        <span className={Number(row.amount) < 0 ? "text-danger" : undefined}>{format.thb(row.amount)}</span>
      ),
    },
    {
      id: "availableAt",
      header: t("columns.available"),
      hideable: true,
      cell: (row) =>
        row.earnedAt ? (
          <span className="text-sm">{t("earnedOn", { date: format.date(row.earnedAt) })}</span>
        ) : row.availableAt ? (
          <span className="text-muted text-sm">{t("availableOn", { date: format.date(row.availableAt) })}</span>
        ) : (
          "–"
        ),
    },
    { id: "createdAt", header: t("columns.created"), hideable: true, cell: (row) => <When at={row.createdAt} /> },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canDecide && row.status === "held" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setDeciding({ row, decision: "release" })}>
              {t("release")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeciding({ row, decision: "cancel" })}>
              {t("cancel")}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...COMMISSION_STATUSES.map((status) => ({
            value: status,
            label: tStatus(AGENT_COMMISSION_STATUS[status].labelKey),
          })),
        ]}
      />
      <ResourceList
        resource={commissionsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowTone={(row) => (row.status === "held" ? "warning" : undefined)}
        filters={[
          {
            id: "kind",
            label: t("columns.kind"),
            kind: "select",
            options: COMMISSION_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) })),
          },
        ]}
        toolbarEnd={
          canAdjust ? (
            <Button iconStart="plus" variant="secondary" onClick={() => setAdjusting(true)}>
              {t("adjust")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty") }}
      />
      {adjusting ? <AdjustDialog onClose={() => setAdjusting(false)} /> : null}
      {deciding ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setDeciding(null))}
          title={t(`${deciding.decision}Title`)}
          description={t(`${deciding.decision}Body`, {
            amount: format.thb(deciding.row.amount),
            agent: deciding.row.agent.legalName,
          })}
          confirmLabel={t(deciding.decision)}
          tone={deciding.decision === "cancel" ? "destructive" : "primary"}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/agent-commissions/{commissionId}/actions/decide", {
                params: { path: { commissionId: deciding.row.id } },
                body: { decision: deciding.decision, reason },
              });
              refresh();
              toast.success(t("decided"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A manual adjustment (`admin.agentCommissions.adjust`): a positive or negative amount with a note,
 * earned at once and carried on the agent's next statement. One idempotency key per opening, so a
 * retried submit cannot add it twice.
 */
function AdjustDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents.adjust");
  const format = useFormat();
  const refresh = useRefreshAgents();
  const [key] = useState(newIdempotencyKey);
  const [agent, setAgent] = useState<ComboboxOption | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!agent) throw new FormError(t("needAgent"));
        if (!/^-?\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) === 0) throw new FormError(t("needAmount"));
        if (note.trim().length < 3) throw new FormError(t("needNote"));
        await adminBrowserApis().contract.POST("/v1/admin/agent-commissions", {
          params: { header: { "Idempotency-Key": key } },
          body: { agentId: agent.value, amount: Number(amount).toFixed(2), note: note.trim() },
        });
        refresh();
        toast.success(t("done", { amount: format.thb(Number(amount).toFixed(2)), agent: agent.label }));
      }}
    >
      <Field label={t("agent")} required>
        <RecordPicker kind="agent" value={agent} onValueChange={setAgent} />
      </Field>
      <Field label={t("amount")} hint={t("amountHint")} required>
        <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label={t("note")} hint={t("noteHint")} required>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
