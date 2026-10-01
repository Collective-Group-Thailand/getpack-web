"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { ColumnToggle } from "@/ui/components/ColumnToggle";
import { DataTable, type DataTableColumn, type RowTone } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Toolbar } from "@/ui/components/PageHeader";
import { Pagination } from "@/ui/components/Pagination";
import { Button } from "@/ui/components/Button";

import { adminBrowserApis } from "./api";
import { ExportButton, type ListExportResource } from "./ExportButton";
import { FilterControl, ListSearch, type FilterDef } from "./filters";
import { toApiQuery, viewQuery } from "./list-state";
import { QueryError } from "./QueryError";
import type { InitialPage, ListResource } from "./resource";
import { SavedViews } from "./SavedViews";
import { useListState } from "./useListState";

export interface ResourceListProps<TRow extends object> {
  resource: ListResource<TRow>;
  columns: readonly DataTableColumn<TRow>[];
  /** The table's accessible name. */
  caption: string;
  filters?: readonly FilterDef[];
  /** Label of the search box; omit for a list the API cannot search. */
  searchLabel?: string;
  searchPlaceholder?: string;
  initial?: InitialPage<TRow> | null;
  /** Actions for the selected rows. Selection only appears when this is given. */
  bulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  rowTone?: (row: TRow) => RowTone | undefined;
  savedViews?: boolean;
  /** The list's published export (`admin.exports.create`); omit for a list the API cannot export. */
  exportResource?: ListExportResource;
  /** Extra controls at the end of the toolbar (import, create). */
  toolbarEnd?: React.ReactNode;
  empty?: { title: string; description?: string; action?: React.ReactNode };
}

/**
 * A back-office list: toolbar (search, filters, saved views, columns), bulk bar, server
 * table and pagination — all driven by the URL (`./list-state.ts`).
 *
 * The first page arrives with the HTML: the Server Component fetches it with the same resource
 * definition and passes it as `initial`, and TanStack Query adopts it only if the query matches,
 * so a client-side filter change can never be answered with the server's stale page.
 *
 * The export button appears on the lists `admin.exports.create` covers (orders, customers,
 * companies, shipments, claims) and exports the list as it is filtered now. Other lists have no
 * export (reports export through `admin.reports.export`, the audit log and catalogue their own).
 */
export function ResourceList<TRow extends object>({
  resource,
  columns,
  caption,
  filters = [],
  searchLabel,
  searchPlaceholder,
  initial,
  bulkActions,
  rowTone,
  savedViews = true,
  exportResource,
  toolbarEnd,
  empty,
}: ResourceListProps<TRow>) {
  const t = useTranslations("console.list");
  const format = useFormat();
  const { state, update, setFilter, applyQuery, defaults } = useListState(resource.defaults);
  const [selected, setSelected] = useState<string[]>([]);

  const apiQuery = toApiQuery(state);
  const matchesInitial = initial && JSON.stringify(initial.query) === JSON.stringify(apiQuery);

  const query = useQuery({
    queryKey: queryKeys.list("admin", resource.key, apiQuery),
    queryFn: () => resource.fetch(adminBrowserApis(), apiQuery),
    placeholderData: keepPreviousData,
    initialData: matchesInitial ? initial.data : undefined,
    staleTime: resource.staleTime,
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const resourceName = resource.resourceName ?? resource.key;
  const currentViewQuery = viewQuery(state, defaults);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar label={t("toolbar")}>
        {searchLabel ? (
          <ListSearch
            value={state.q}
            onChange={(q) => update({ q })}
            label={searchLabel}
            placeholder={searchPlaceholder}
          />
        ) : null}
        {filters.map((filter) => (
          <FilterControl
            key={filter.id}
            filter={filter}
            value={state.filters[filter.id]}
            onChange={(value) => setFilter(filter.id, value)}
          />
        ))}
        {state.q || JSON.stringify(state.filters) !== JSON.stringify(defaults.filters ?? {}) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => update({ q: "", filters: { ...defaults.filters } })}
          >
            {t("clearFilters")}
          </Button>
        ) : null}
        <div className="ms-auto flex items-end gap-2">
          {savedViews ? (
            <SavedViews resource={resourceName} currentQuery={currentViewQuery} columns={null} onApply={applyQuery} />
          ) : null}
          <ColumnToggle
            label={t("columns")}
            columns={columns.map((column) => ({
              id: column.id,
              label: typeof column.header === "string" ? column.header : column.id,
              hideable: column.hideable,
            }))}
            hidden={state.hidden}
            onHiddenChange={(hidden) => update({ hidden })}
          />
          {exportResource ? <ExportButton resource={exportResource} query={currentViewQuery} /> : null}
          {toolbarEnd}
        </div>
      </Toolbar>

      {bulkActions && selected.length > 0 ? (
        <div
          role="region"
          aria-label={t("bulk")}
          className="bg-primary-subtle text-primary-subtle-fg flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-sm"
        >
          <span className="font-medium">{t("selected", { count: selected.length })}</span>
          {bulkActions(selected, () => setSelected([]))}
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            {t("clearSelection")}
          </Button>
        </div>
      ) : null}

      <DataTable
        caption={caption}
        columns={columns}
        rows={rows}
        getRowId={resource.getRowId}
        getRowName={resource.getRowName}
        sort={state.sort ? { id: state.sort, desc: state.order === "desc" } : null}
        onSortChange={(sort) => update({ sort: sort.id, order: sort.desc ? "desc" : "asc" })}
        hiddenColumns={state.hidden}
        selectable={Boolean(bulkActions)}
        selected={selected}
        onSelectedChange={setSelected}
        loading={query.isFetching}
        rowTone={rowTone}
        skeletonRows={Math.min(state.perPage, 10)}
        labels={{ selectAll: t("selectAll"), selectRow: (name) => t("selectRow", { name }), sortBy: t("sortBy") }}
        error={
          query.isError && rows.length === 0 ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon="inbox"
            title={empty?.title ?? t("emptyTitle")}
            description={
              empty?.description ?? (state.q || Object.keys(state.filters).length > 0 ? t("emptyFiltered") : undefined)
            }
            action={empty?.action}
          />
        }
      />

      {meta && meta.total > 0 ? (
        <Pagination
          page={meta.page}
          perPage={state.perPage}
          total={meta.total}
          onPageChange={(page) => update({ page })}
          onPerPageChange={(perPage) => update({ perPage })}
          labels={{
            nav: t("pagination"),
            previous: t("previous"),
            next: t("next"),
            range: (from, to, total) =>
              t("range", { from: format.number(from), to: format.number(to), total: format.number(total) }),
            pageOf: (page, pages) => t("pageOf", { page: format.number(page), pages: format.number(pages) }),
            perPage: t("perPage"),
          }}
        />
      ) : null}
    </div>
  );
}
