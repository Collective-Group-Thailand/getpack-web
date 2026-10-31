"use client";

import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AUDIT_OUTCOME_STATUS, statusMeta } from "@/domain/status";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconButton } from "@/ui/components/IconButton";
import { JsonView } from "@/ui/components/JsonView";
import Link from "next/link";
import { Toolbar } from "@/ui/components/PageHeader";
import { Sheet } from "@/ui/components/Sheet";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import {
  adminBrowserApis,
  download,
  FilterControl,
  problemMessage,
  QueryError,
  shortRef,
  useCan,
  useListState,
} from "../console";
import { auditLines, auditRecordHref } from "./audit-links";

type Entry = Schemas["AuditEntryDto"];

const CATEGORIES: Schemas["AuditCategory"][] = [
  "security",
  "finance",
  "config",
  "data_access",
  "export",
  "approval",
  "iam",
];
/** The record types the log names in words (`audit.resourceTypes`); the filter offers these. */
const RESOURCE_TYPES = [
  "user",
  "order",
  "setting",
  "factory",
  "company",
  "approval_request",
  "shipment",
  "sample",
  "sales_agent",
  "payout_run",
  "journal_entry",
  "tax_report",
  "vendor",
  "vendor_invoice",
  "customer_document",
  "file",
  "api_client",
  "notification_template",
  "close_task",
  "bank_statement_line",
  "report_schedule",
] as const;
const FILTER_KEYS = ["category", "outcome", "action", "resourceType", "resourceId", "actorId", "from", "to"] as const;
const PAGE = 50;

/** A `YYYY-MM-DD` filter as the instant the API wants: the start of that day in Bangkok. */
function startOfBangkokDay(date: string | undefined, plusDays = 0): string | undefined {
  if (!date) return undefined;
  const day = new Date(`${date}T00:00:00+07:00`);
  day.setUTCDate(day.getUTCDate() + plusDays);
  return day.toISOString();
}

/**
 * The audit log (D-140, D-033 §8): logins, role changes, permission denials, setting changes,
 * exports, approvals. Read-only for everyone — including the time-boxed Auditor it exists for —
 * because an audit log that can be edited from the UI is not one.
 *
 * Cursor-paginated (api-conventions §3 feeds), so it loads more rather than numbering pages;
 * the filters live in the URL like every other list.
 */
export function AuditLog() {
  const t = useTranslations("platform.audit");
  const tStatus = useTranslations("status");
  const canExport = useCan("audit_logs.export");
  const { state, setFilter, update } = useListState({ filterKeys: FILTER_KEYS });
  const [open, setOpen] = useState<Entry | null>(null);

  const filters = state.filters;
  const query = {
    category: filters.category as Schemas["AuditCategory"] | undefined,
    outcome: filters.outcome as Schemas["AuditOutcome"] | undefined,
    action: filters.action,
    resourceType: filters.resourceType,
    resourceId: filters.resourceId,
    actorId: filters.actorId,
    // `to` is exclusive in the contract, so a "to" date includes that whole day.
    from: startOfBangkokDay(filters.from),
    to: startOfBangkokDay(filters.to, 1),
  };

  const feed = useInfiniteQuery({
    queryKey: queryKeys.list("admin", "audit_log", query),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/audit-logs", {
          params: { query: { ...query, cursor: pageParam, limit: PAGE } },
        })
      ).data!,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const exportCsv = useMutation({
    mutationFn: async () =>
      (await adminBrowserApis().contract.POST("/v1/admin/audit-logs/exports", { body: query })).data!,
    onSuccess: (file) => {
      if (file.truncated) toast.warning(t("exportTruncated", { rows: file.rows }));
      download(file.url);
    },
    onError: (error) => toast.error(problemMessage(error, t("exportFailed"))),
  });

  const rows = feed.data?.pages.flatMap((page) => page.data) ?? [];

  const columns: DataTableColumn<Entry>[] = [
    {
      id: "occurredAt",
      header: t("columns.when"),
      className: "whitespace-nowrap",
      cell: (row) => <When at={row.occurredAt} absoluteOnly />,
    },
    {
      id: "action",
      header: t("columns.action"),
      cell: (row) => <code className="font-mono text-xs [overflow-wrap:anywhere]">{row.action}</code>,
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: (row) => <span className="text-muted">{t(`categories.${row.category}`)}</span>,
    },
    {
      id: "outcome",
      header: t("columns.outcome"),
      cell: (row) => {
        const meta = statusMeta(AUDIT_OUTCOME_STATUS, row.outcome);
        return <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />;
      },
    },
    { id: "actor", header: t("columns.actor"), cell: (row) => <Actor entry={row} /> },
    { id: "resource", header: t("columns.resource"), cell: (row) => <Entity entry={row} /> },
    {
      id: "open",
      header: <span className="sr-only">{t("columns.details")}</span>,
      hideable: false,
      // The whole card opens the entry on a phone; the chevron is for the desk table.
      className: "w-12 text-end max-md:hidden!",
      cell: (row) => (
        <IconButton
          name="chevron-right"
          size="sm"
          variant="ghost"
          label={t("openEntry", { action: row.action })}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(row);
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        label={t("filters")}
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]"
      >
        <FilterControl
          filter={{ id: "from", label: t("from"), kind: "date" }}
          value={filters.from}
          onChange={(value) => setFilter("from", value)}
        />
        <FilterControl
          filter={{ id: "to", label: t("to"), kind: "date" }}
          value={filters.to}
          onChange={(value) => setFilter("to", value)}
        />
        <FilterControl
          filter={{
            id: "category",
            label: t("columns.category"),
            kind: "select",
            options: CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) })),
          }}
          value={filters.category}
          onChange={(value) => setFilter("category", value)}
        />
        <FilterControl
          filter={{
            id: "outcome",
            label: t("columns.outcome"),
            kind: "select",
            options: Object.entries(AUDIT_OUTCOME_STATUS).map(([value, meta]) => ({
              value,
              label: tStatus(meta.labelKey),
            })),
          }}
          value={filters.outcome}
          onChange={(value) => setFilter("outcome", value)}
        />
        <FilterControl
          filter={{ id: "action", label: t("columns.action"), kind: "text", placeholder: t("actionPlaceholder") }}
          value={filters.action}
          onChange={(value) => setFilter("action", value)}
        />
        <FilterControl
          filter={{
            id: "resourceType",
            label: t("resourceType"),
            kind: "select",
            options: RESOURCE_TYPES.map((value) => ({ value, label: t(`resourceTypes.${value}`) })),
          }}
          value={filters.resourceType}
          onChange={(value) => setFilter("resourceType", value)}
        />
        <div className="col-span-full flex items-center justify-end gap-2 xl:col-span-1">
          {Object.keys(filters).length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => update({ filters: {} })}>
              {t("clear")}
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="secondary"
              size="sm"
              iconStart="download"
              loading={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              {t("export")}
            </Button>
          ) : null}
        </div>
      </Toolbar>

      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rows}
        getRowId={(row) => `${row.occurredAt}:${row.requestId ?? ""}:${row.action}`}
        loading={feed.isFetching && rows.length === 0}
        density="compact"
        rowTone={(row) => (row.outcome === "denied" ? "warning" : row.outcome === "failure" ? "danger" : undefined)}
        onRowClick={setOpen}
        error={feed.isError ? <QueryError error={feed.error} onRetry={() => void feed.refetch()} /> : undefined}
        empty={
          <EmptyState
            icon="history"
            title={t("empty")}
            action={
              Object.keys(filters).length > 0 ? (
                <Button variant="secondary" onClick={() => update({ filters: {} })}>
                  {t("clear")}
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href="/users">{t("openUsers")}</Link>
                </Button>
              )
            }
          />
        }
      />
      {feed.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          loading={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {t("loadMore")}
        </Button>
      ) : null}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => (next ? undefined : setOpen(null))}
        title={t("entryTitle")}
        closeLabel={t("close")}
      >
        {open ? (
          <div className="flex flex-col gap-5">
            <DescriptionList
              columns={1}
              items={[
                { term: t("columns.when"), description: <When at={open.occurredAt} absoluteOnly /> },
                {
                  term: t("columns.action"),
                  description: (
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm">{open.action}</code>
                      <span className="text-muted text-sm">{t(`categories.${open.category}`)}</span>
                    </span>
                  ),
                },
                { term: t("columns.actor"), description: <Actor entry={open} /> },
                ...(open.onBehalfOf ? [{ term: t("onBehalfOf"), description: open.onBehalfOf }] : []),
                { term: t("columns.resource"), description: <Entity entry={open} /> },
                {
                  term: t("requestId"),
                  description: (
                    <code className="font-mono text-xs [overflow-wrap:anywhere]">{open.requestId ?? "—"}</code>
                  ),
                },
              ]}
            />
            <section aria-labelledby="audit-data" className="flex flex-col gap-2">
              <div>
                <h3 id="audit-data" className="text-sm font-semibold">
                  {t("data")}
                </h3>
                <p className="text-muted text-xs">{t("redacted")}</p>
              </div>
              <AuditData data={open.data} />
              <details className="group">
                <summary className="text-muted hover:text-fg cursor-pointer text-xs font-medium">{t("raw")}</summary>
                <JsonView value={open.data} label={t("data")} className="mt-2" />
              </details>
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/** Who did it: a person links to their account; a system or an outside client is named by its kind. */
function Actor({ entry }: { entry: Entry }) {
  const t = useTranslations("platform.audit");
  const kind = t(`actorTypes.${entry.actor.type}`);
  if (entry.actor.type === "user" && entry.actor.id)
    return (
      <Link href={`/users/${entry.actor.id}`} className="text-primary hover:underline">
        {entry.actor.name ?? kind}
      </Link>
    );
  return <span className={entry.actor.name ? undefined : "text-muted"}>{entry.actor.name ?? kind}</span>;
}

/** The record the entry is about: a link to its page when the console has one. */
function Entity({ entry }: { entry: Entry }) {
  const t = useTranslations("platform.audit");
  if (!entry.resourceType) return <span className="text-muted">—</span>;
  const type = t.has(`resourceTypes.${entry.resourceType}`)
    ? t(`resourceTypes.${entry.resourceType}`)
    : entry.resourceType;
  const href = auditRecordHref(entry.resourceType, entry.resourceId);
  return href ? (
    <Link href={href} className="text-primary hover:underline">
      {type}
    </Link>
  ) : (
    <span>{entry.resourceId ? shortRef(type, entry.resourceId) : type}</span>
  );
}

const plain = (value: unknown) =>
  value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** The entry's data as lines: changed fields as "before → after", the rest as field and value. */
function AuditData({ data }: { data: unknown }) {
  const t = useTranslations("platform.audit");
  const lines = auditLines(data);
  if (!lines.length) return <p className="text-muted text-sm">{t("noData")}</p>;
  return (
    <dl className="border-border divide-border rounded-control divide-y border text-sm">
      {lines.map((line, at) => (
        <div key={`${line.key}-${at}`} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-muted font-mono text-xs [overflow-wrap:anywhere]">{line.key || t("change")}</dt>
          <dd className="[overflow-wrap:anywhere]">
            {"value" in line ? (
              plain(line.value)
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted line-through decoration-1">{plain(line.before)}</span>
                <Icon name="arrow-right" size={14} label={t("changedTo")} />
                <span className="font-medium">{plain(line.after)}</span>
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
