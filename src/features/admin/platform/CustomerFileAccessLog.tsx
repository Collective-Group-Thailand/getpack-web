"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconButton } from "@/ui/components/IconButton";
import { Toolbar } from "@/ui/components/PageHeader";
import { Sheet } from "@/ui/components/Sheet";

import { adminBrowserApis, FilterControl, QueryError, useListState, useStaffDirectory } from "../console";
import { ExportButton } from "../console/ExportButton";

type Entry = Schemas["FileAccessLogEntryDto"];
type FileKind = Schemas["CustomerFileKind"];

const FILE_KINDS: FileKind[] = ["customer_original", "production_copy", "approved_proof_copy"];
/** The "kind" filter: a file kind, or the accesses a Superadmin opened with a typed reason (D-449 (1)). */
const REASON = "reason";
const FILTER_KEYS = ["kind", "userId", "orderCode", "fileId", "from", "to"] as const;
const PAGE = 50;
const ORDER_CODE = /^[A-Za-z0-9-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A `YYYY-MM-DD` filter as the instant the API wants: the start of that day in Bangkok. */
function startOfBangkokDay(date: string | undefined, plusDays = 0): string | undefined {
  if (!date) return undefined;
  const day = new Date(`${date}T00:00:00+07:00`);
  day.setUTCDate(day.getUTCDate() + plusDays);
  return day.toISOString();
}

/** The page's URL filters as the list endpoint's query (unusable typed values are left out, not sent). */
export function fileAccessLogQuery(filters: Partial<Record<(typeof FILTER_KEYS)[number], string>>) {
  const kind = filters.kind;
  return {
    fileKind: FILE_KINDS.find((k) => k === kind),
    withReason: kind === REASON ? true : undefined,
    userId: filters.userId && UUID.test(filters.userId) ? filters.userId : undefined,
    orderCode: filters.orderCode && ORDER_CODE.test(filters.orderCode.trim()) ? filters.orderCode.trim() : undefined,
    fileId: filters.fileId && UUID.test(filters.fileId.trim()) ? filters.fileId.trim() : undefined,
    // `to` is exclusive in the contract, so a "to" date includes that whole day.
    from: startOfBangkokDay(filters.from),
    to: startOfBangkokDay(filters.to, 1),
  };
}

/** The same filters for `admin.exports.create` (`customer_file_access_logs`): days stay days, as the export reads them. */
export function fileAccessLogExportQuery(
  filters: Partial<Record<(typeof FILTER_KEYS)[number], string>>,
): Record<string, string> {
  const q = fileAccessLogQuery(filters);
  const out: Record<string, string> = {};
  if (q.fileKind) out.fileKind = q.fileKind;
  if (q.withReason) out.withReason = "true";
  if (q.userId) out.userId = q.userId;
  if (q.orderCode) out.orderCode = q.orderCode;
  if (q.fileId) out.fileId = q.fileId;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  return out;
}

/**
 * The customer file access log (D-444; C1f, owner 2026-10-28 13:58, D-451): every download URL issued for a
 * customer's original, a production copy or an approved proof copy — who, when, which order and file, through which
 * surface — and, for a Superadmin who opened one (D-449 (1)), the reason they typed. Read-only for whoever holds
 * `customer_file_access_logs.read` (Superadmin, Auditor); the API decides who sees the page. A cursor feed like the
 * audit log; the filters live in the URL; CSV / XLSX through the list export.
 */
export function CustomerFileAccessLog() {
  const t = useTranslations("platform.fileAccess");
  const { state, setFilter, update } = useListState({ filterKeys: FILTER_KEYS });
  const [open, setOpen] = useState<Entry | null>(null);
  const staff = useStaffDirectory({ q: "", limit: 50 });

  const filters = state.filters as Partial<Record<(typeof FILTER_KEYS)[number], string>>;
  const query = fileAccessLogQuery(filters);

  const feed = useInfiniteQuery({
    queryKey: queryKeys.list("admin", "customer_file_access_log", query),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-file-access-logs", {
          params: { query: { ...query, cursor: pageParam, limit: PAGE } },
        })
      ).data!,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const rows = feed.data?.pages.flatMap((page) => page.data) ?? [];
  const actorName = (row: Entry) => row.actor.name ?? t(`actorTypes.${row.actor.type}`);

  const columns: DataTableColumn<Entry>[] = [
    {
      id: "occurredAt",
      header: t("columns.when"),
      className: "whitespace-nowrap",
      cell: (row) => <When at={row.occurredAt} absoluteOnly />,
    },
    {
      id: "actor",
      header: t("columns.actor"),
      cell: (row) =>
        row.actor.type === "user" && row.actor.id ? (
          <Link href={`/users/${row.actor.id}`} className="text-primary hover:underline">
            {actorName(row)}
          </Link>
        ) : (
          actorName(row)
        ),
    },
    {
      id: "order",
      header: t("columns.order"),
      cell: (row) =>
        row.order ? (
          <Link href={`/orders/${row.order.id}`} className="text-primary tabular-nums hover:underline">
            {row.order.orderCode}
          </Link>
        ) : (
          <span className="text-muted">{t("noOrder")}</span>
        ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => t(`kinds.${row.fileKind}`) },
    {
      id: "access",
      header: t("columns.access"),
      cell: (row) => `${t(`purposes.${row.purpose}`)} · ${t(`channels.${row.channel}`)}`,
    },
    {
      id: "reason",
      header: t("columns.reason"),
      cell: (row) =>
        row.reason ? (
          <span className="flex min-w-0 items-center gap-2">
            <Badge tone="warning">{t("withReason")}</Badge>
            <span className="truncate text-sm">{row.reason}</span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
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
          label={t("openEntry", { order: row.order?.orderCode ?? row.fileId.slice(0, 8) })}
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
            id: "kind",
            label: t("columns.kind"),
            kind: "select",
            options: [
              ...FILE_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) })),
              { value: REASON, label: t("kinds.reason") },
            ],
          }}
          value={filters.kind}
          onChange={(value) => setFilter("kind", value)}
        />
        <FilterControl
          filter={{
            id: "userId",
            label: t("columns.actor"),
            kind: "select",
            options: (staff.data ?? []).map((person) => ({ value: person.id, label: person.displayName })),
          }}
          value={filters.userId}
          onChange={(value) => setFilter("userId", value)}
        />
        <FilterControl
          filter={{ id: "orderCode", label: t("columns.order"), kind: "text", placeholder: t("orderPlaceholder") }}
          value={filters.orderCode}
          onChange={(value) => setFilter("orderCode", value)}
        />
        <FilterControl
          filter={{ id: "fileId", label: t("fileId"), kind: "text", placeholder: t("fileIdPlaceholder") }}
          value={filters.fileId}
          onChange={(value) => setFilter("fileId", value)}
        />
        <div className="col-span-full flex items-center justify-end gap-2 xl:col-span-1">
          {Object.keys(filters).length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => update({ filters: {} })}>
              {t("clear")}
            </Button>
          ) : null}
          <ExportButton resource="customer_file_access_logs" query={fileAccessLogExportQuery(filters)} />
        </div>
      </Toolbar>

      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={feed.isFetching && rows.length === 0}
        density="compact"
        rowTone={(row) => (row.reason ? "warning" : undefined)}
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
          <DescriptionList
            columns={1}
            items={[
              { term: t("columns.when"), description: <When at={open.occurredAt} absoluteOnly /> },
              { term: t("columns.actor"), description: `${actorName(open)} (${t(`actorTypes.${open.actor.type}`)})` },
              {
                term: t("columns.order"),
                description: open.order ? (
                  <Link href={`/orders/${open.order.id}`} className="text-primary hover:underline">
                    {open.order.orderCode}
                  </Link>
                ) : (
                  t("noOrder")
                ),
              },
              { term: t("columns.kind"), description: t(`kinds.${open.fileKind}`) },
              { term: t("fileId"), description: <span className="text-xs break-all tabular-nums">{open.fileId}</span> },
              {
                term: t("columns.access"),
                description: `${t(`purposes.${open.purpose}`)} · ${t(`channels.${open.channel}`)}`,
              },
              { term: t("columns.reason"), description: open.reason ?? t("noReason") },
              {
                term: t("requestId"),
                description: <span className="text-xs tabular-nums">{open.requestId ?? "—"}</span>,
              },
            ]}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
