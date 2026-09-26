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
import { Toolbar } from "@/ui/components/PageHeader";
import { Sheet } from "@/ui/components/Sheet";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";

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
    { id: "occurredAt", header: t("columns.when"), cell: (row) => <When at={row.occurredAt} /> },
    { id: "category", header: t("columns.category"), cell: (row) => t(`categories.${row.category}`) },
    {
      id: "action",
      header: t("columns.action"),
      cell: (row) => <span className="font-mono text-xs">{row.action}</span>,
    },
    {
      id: "outcome",
      header: t("columns.outcome"),
      cell: (row) => {
        const meta = statusMeta(AUDIT_OUTCOME_STATUS, row.outcome);
        return <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />;
      },
    },
    { id: "actor", header: t("columns.actor"), cell: (row) => row.actor.name ?? t(`actorTypes.${row.actor.type}`) },
    {
      id: "resource",
      header: t("columns.resource"),
      cell: (row) => <span className="text-xs">{shortRef(row.resourceType, row.resourceId)}</span>,
    },
    {
      id: "open",
      header: <span className="sr-only">{t("columns.details")}</span>,
      hideable: false,
      className: "w-12 text-end",
      cell: (row) => (
        <IconButton
          name="eye"
          size="sm"
          variant="ghost"
          label={t("openEntry", { action: row.action })}
          onClick={() => setOpen(row)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Toolbar label={t("filters")}>
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
          filter={{ id: "resourceType", label: t("resourceType"), kind: "text" }}
          value={filters.resourceType}
          onChange={(value) => setFilter("resourceType", value)}
        />
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
        {Object.keys(filters).length > 0 ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => update({ filters: {} })}>
            {t("clear")}
          </Button>
        ) : null}
        {canExport ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart="download"
            className="ms-auto"
            loading={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            {t("export")}
          </Button>
        ) : null}
      </Toolbar>

      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rows}
        getRowId={(row) => `${row.occurredAt}:${row.requestId ?? ""}:${row.action}`}
        loading={feed.isFetching && rows.length === 0}
        density="compact"
        rowTone={(row) => (row.outcome === "denied" ? "warning" : row.outcome === "failure" ? "danger" : undefined)}
        error={feed.isError ? <QueryError error={feed.error} onRetry={() => void feed.refetch()} /> : undefined}
        empty={<EmptyState icon="history" title={t("empty")} />}
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
          <div className="space-y-4">
            <DescriptionList
              columns={1}
              items={[
                { term: t("columns.when"), description: <When at={open.occurredAt} absoluteOnly /> },
                { term: t("columns.action"), description: <span className="font-mono">{open.action}</span> },
                {
                  term: t("columns.actor"),
                  description: `${open.actor.name ?? "—"} (${t(`actorTypes.${open.actor.type}`)})`,
                },
                ...(open.onBehalfOf ? [{ term: t("onBehalfOf"), description: open.onBehalfOf }] : []),
                {
                  term: t("columns.resource"),
                  description: open.resourceType ? `${open.resourceType} ${open.resourceId ?? ""}` : "—",
                },
                {
                  term: t("requestId"),
                  description: <span className="font-mono text-xs">{open.requestId ?? "—"}</span>,
                },
              ]}
            />
            <div>
              <p className="mb-1 text-sm font-medium">{t("data")}</p>
              <p className="text-muted mb-2 text-xs">{t("redacted")}</p>
              <JsonView value={open.data} label={t("data")} />
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
