"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { SALES_AUTHORITY_LEVEL, SALES_DISCOUNT_APPROVAL_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";

import { QueueTabs, ResourceList, StatusChip, useSlaFormat, type FilterDef, type InitialPage } from "../../console";
import { Figure } from "../figure";
import {
  APPROVAL_LEVELS,
  APPROVAL_STATUSES,
  approvalsList,
  waterfallViewsList,
  type ApprovalSummary,
  type WaterfallView,
} from "../resources";

/**
 * The discount approval desk's queue (D-470): pending first by due time with the SLA timer, the asked percentage, the
 * authority colour (words + icon, never colour alone), the level that decides, the round and a negotiation-heavy
 * mark. No figure about cost or margin is in a summary — those live in the record, in the caller's tier.
 */
export function ApprovalsQueue({ initial }: { initial: InitialPage<ApprovalSummary> | null }) {
  const t = useTranslations("sales.approvals");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const columns: DataTableColumn<ApprovalSummary>[] = [
    {
      id: "quote",
      header: t("columns.quote"),
      cell: (row) => (
        <div className="flex max-w-[20rem] min-w-0 flex-col">
          <Link href={`/sales/approvals/${row.id}`} className="text-primary truncate font-medium hover:underline">
            {row.lead.organisationName ?? row.lead.contactName}
          </Link>
          <span className="text-muted text-xs tabular-nums">
            {row.quote.quoteCode ?? "—"} · {t("round", { round: row.round })}
          </span>
        </div>
      ),
    },
    {
      id: "agent",
      header: t("columns.agent"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="max-w-[12rem] truncate text-sm">{row.agent.legalName}</span>
          <span className="text-muted text-xs tabular-nums">
            {row.agent.code} · {t(`kinds.${row.agent.kind}`)}
          </span>
        </div>
      ),
    },
    {
      id: "pct",
      header: t("columns.pct"),
      cell: (row) => (
        <Figure
          name="requestedPct"
          source={{ label: row.quote.quoteCode ?? t("columns.quote"), href: `/sales/approvals/${row.id}` }}
          asOf={row.createdAt}
          className="font-semibold tabular-nums"
        >
          {format.percent(row.requestedPct)}
        </Figure>
      ),
    },
    {
      id: "level",
      header: t("columns.level"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip map={SALES_AUTHORITY_LEVEL} value={row.authorityLevel} />
          <span className="text-muted text-xs">
            {t(`levels.${row.level}`)}
            {row.level !== row.baseLevel ? ` · ${t("raised")}` : ""}
          </span>
          {row.negotiationHeavy ? (
            <span className="text-warning-subtle-fg text-xs font-medium">{t("heavy")}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "due",
      header: t("columns.due"),
      cell: (row) =>
        row.status === "pending" ? (
          <div className="flex flex-col gap-0.5">
            <SlaTimer
              dueAt={row.dueAt}
              state={row.overdue ? "breached" : undefined}
              format={sla}
              absolute={t("dueAt", { at: format.dateTime(row.dueAt) })}
            />
            {row.escalatedAt ? <span className="text-danger text-xs">{t("escalated")}</span> : null}
          </div>
        ) : (
          <span className="text-muted text-xs">
            {row.decidedBy?.displayName ?? "—"}
            {row.decidedAt ? ` · ${format.dateTime(row.decidedAt, { style: "dayMonth" })}` : ""}
          </span>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={SALES_DISCOUNT_APPROVAL_STATUS} value={row.status} />,
    },
    { id: "createdAt", header: t("columns.created"), cell: (row) => <When at={row.createdAt} /> },
  ];
  const filters: FilterDef[] = [
    {
      id: "level",
      label: t("columns.level"),
      kind: "select",
      options: APPROVAL_LEVELS.map((level) => ({ value: level, label: t(`levels.${level}`) })),
    },
    {
      id: "awaitingMe",
      label: t("awaitingMeLabel"),
      kind: "select",
      options: [{ value: "true", label: t("awaitingMe") }],
    },
  ];
  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={approvalsList}
          hideEmpty
          label={t("statusesLabel")}
          param="status"
          tabs={[
            { value: null, label: t("all") },
            ...APPROVAL_STATUSES.map((status) => ({
              value: status,
              label: tStatus(SALES_DISCOUNT_APPROVAL_STATUS[status].labelKey),
            })),
          ]}
        />
      }
      resource={approvalsList}
      columns={columns}
      caption={t("title")}
      filters={filters}
      initial={initial}
      searchLabel={t("search")}
      savedViews={false}
      rowHref={(row) => `/sales/approvals/${row.id}`}
      rowTone={(row) => (row.status === "pending" ? (row.overdue ? "danger" : "warning") : undefined)}
      empty={{
        title: t("empty"),
        description: t("emptyHint"),
        action: (
          <Button asChild variant="secondary" iconStart="receipt">
            <Link href="/sales/quotes">{t("toQuotes")}</Link>
          </Button>
        ),
      }}
    />
  );
}

/** Who opened which waterfall, in which tier and why (D-470 access log, `sales_waterfall_views.read`). */
export function WaterfallViewsLog({ initial }: { initial: InitialPage<WaterfallView> | null }) {
  const t = useTranslations("sales.views");
  const format = useFormat();
  const columns: DataTableColumn<WaterfallView>[] = [
    {
      id: "viewedAt",
      header: t("columns.viewedAt"),
      cell: (row) => <span className="tabular-nums">{format.dateTime(row.viewedAt)}</span>,
    },
    {
      id: "viewer",
      header: t("columns.viewer"),
      cell: (row) => <span className="font-medium">{row.viewer.displayName}</span>,
    },
    {
      id: "quote",
      header: t("columns.quote"),
      cell: (row) =>
        row.approvalId ? (
          <Link href={`/sales/approvals/${row.approvalId}`} className="text-primary tabular-nums hover:underline">
            {row.quoteCode ?? row.quoteId.slice(0, 8)}
          </Link>
        ) : (
          <span className="tabular-nums">{row.quoteCode ?? row.quoteId.slice(0, 8)}</span>
        ),
    },
    { id: "tier", header: t("columns.tier"), cell: (row) => <span>{t(`tiers.${row.tier}`)}</span> },
    { id: "purpose", header: t("columns.purpose"), cell: (row) => <span>{t(`purposes.${row.purpose}`)}</span> },
  ];
  return (
    <ResourceList
      resource={waterfallViewsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      savedViews={false}
      empty={{
        title: t("empty"),
        description: t("emptyHint"),
        action: (
          <Button asChild variant="secondary" iconStart="stamp">
            <Link href="/sales/approvals">{t("toApprovals")}</Link>
          </Button>
        ),
      }}
    />
  );
}
