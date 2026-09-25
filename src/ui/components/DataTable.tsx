"use client";

import {
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

/**
 * The server table (design-system.md §3 "DataTable", F2 §2): TanStack Table v9 for the model,
 * our own markup for semantics.
 *
 * **Server-driven.** Sorting, column visibility and selection are all controlled by the caller —
 * in the back office, by the URL — and the table never sorts, filters or pages rows itself: what
 * it shows is exactly the page the API returned (`manualSorting`). That keeps one source of truth
 * for what a list means, and it is the only honest option when the API owns permissions and
 * money.
 *
 * **Accessible by construction.** A real `<table>` with a caption, `scope="col"` headers,
 * `aria-sort` on the sorted column, sort controls that are buttons, and selection checkboxes that
 * name the row they select. Colour is never the only signal: a row tone is a stripe *beside*
 * whatever text the row already carries.
 */

const features = tableFeatures({ rowSortingFeature, columnVisibilityFeature, rowSelectionFeature });

export interface DataTableColumn<TRow> {
  /** Stable id; also the `sort` value sent to the API for a sortable column. */
  id: string;
  header: React.ReactNode;
  cell: (row: TRow) => React.ReactNode;
  sortable?: boolean;
  /** Right-aligned with tabular figures — money, quantities, counts. */
  numeric?: boolean;
  /** May the user hide it? The first column never can: it names the row. */
  hideable?: boolean;
  /** Extra classes for the column's cells, e.g. a width. */
  className?: string;
}

export interface DataTableSort {
  id: string;
  desc: boolean;
}

export type RowTone = "danger" | "warning" | "info";

export interface DataTableLabels {
  /** Name of the select-all checkbox. */
  selectAll: string;
  /** Name of one row's checkbox, given that row's name (e.g. its order code). */
  selectRow: (rowName: string) => string;
  /** Announced on a sortable header, e.g. "เรียงตาม" — the header text follows. */
  sortBy: string;
}

export interface DataTableProps<TRow> {
  /** The table's accessible name. Visually hidden unless `showCaption`. */
  caption: string;
  showCaption?: boolean;
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  /** A short name for a row (its code), used to label its checkbox. */
  getRowName?: (row: TRow) => string;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  hiddenColumns?: readonly string[];
  selectable?: boolean;
  selected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Required when the table is sortable or selectable — those are the only controls with copy. */
  labels?: DataTableLabels;
  /** True while a page is loading. With no rows yet, skeleton rows hold the layout. */
  loading?: boolean;
  /** Rendered in place of the body when there are no rows and nothing is loading. */
  empty?: React.ReactNode;
  /** Rendered in place of the body when the page failed to load. */
  error?: React.ReactNode;
  density?: "comfortable" | "compact";
  rowTone?: (row: TRow) => RowTone | undefined;
  /** How many skeleton rows to draw — match the page size so nothing jumps. */
  skeletonRows?: number;
  className?: string;
}

const EMPTY_ROWS: never[] = [];

export function DataTable<TRow extends RowData>({
  caption,
  showCaption = false,
  columns,
  rows,
  getRowId,
  getRowName,
  sort,
  onSortChange,
  hiddenColumns,
  selectable = false,
  selected,
  onSelectedChange,
  labels,
  loading = false,
  empty,
  error,
  density = "comfortable",
  rowTone,
  skeletonRows = 8,
  className,
}: DataTableProps<TRow>) {
  const definitions = useMemo<ColumnDef<typeof features, TRow>[]>(
    () =>
      columns.map((column, index) => ({
        id: column.id,
        // TanStack only lets a column with an accessor sort. Nothing is sorted client-side
        // (`manualSorting`), so the accessor exists to switch the capability on, not to read data.
        accessorFn: () => column.id,
        header: () => column.header,
        cell: (context) => column.cell(context.row.original),
        enableSorting: Boolean(column.sortable),
        enableHiding: index > 0 && column.hideable !== false,
      })),
    [columns],
  );

  const sorting = useMemo<SortingState>(() => (sort ? [{ id: sort.id, desc: sort.desc }] : []), [sort]);
  const columnVisibility = useMemo<ColumnVisibilityState>(
    () => Object.fromEntries((hiddenColumns ?? []).map((id) => [id, false])),
    [hiddenColumns],
  );
  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries((selected ?? []).map((id) => [id, true])),
    [selected],
  );

  const resolve = <T,>(updater: Updater<T>, current: T): T =>
    typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;

  const table = useTable({
    features,
    columns: definitions,
    data: rows.length > 0 ? (rows as TRow[]) : (EMPTY_ROWS as TRow[]),
    getRowId: (row) => getRowId(row),
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    enableRowSelection: selectable,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: (updater) => {
      const [next] = resolve(updater, sorting);
      if (next) onSortChange?.({ id: next.id, desc: next.desc });
    },
    onColumnVisibilityChange: () => {
      // Visibility is owned by the caller's column menu, which writes `hiddenColumns` directly.
    },
    onRowSelectionChange: (updater) => {
      const next = resolve(updater, rowSelection);
      const chosen = new Set(Object.keys(next).filter((id) => next[id]));
      // In the order the rows appear, then anything chosen on another page — so a bulk action
      // lists what it will touch the way the person saw it.
      const onPage = rows.map((row) => getRowId(row)).filter((id) => chosen.has(id));
      onSelectedChange?.([...onPage, ...[...chosen].filter((id) => !onPage.includes(id))]);
    },
  });

  const cellPadding = density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5";
  const visibleColumns = table.getVisibleLeafColumns();
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const hasRows = rows.length > 0;

  let body: React.ReactNode;
  if (error) {
    body = (
      <tr>
        <td colSpan={colSpan} className="p-6">
          {error}
        </td>
      </tr>
    );
  } else if (!hasRows && loading) {
    body = Array.from({ length: skeletonRows }, (_, index) => (
      <tr key={index} className="border-border border-b" aria-hidden>
        {Array.from({ length: colSpan }, (__, cell) => (
          <td key={cell} className={cellPadding}>
            <div className="bg-surface-subtle h-4 animate-pulse rounded-sm" />
          </td>
        ))}
      </tr>
    ));
  } else if (!hasRows) {
    body = (
      <tr>
        <td colSpan={colSpan} className="p-6">
          {empty}
        </td>
      </tr>
    );
  } else {
    body = table.getRowModel().rows.map((row) => {
      const tone = rowTone?.(row.original);
      const isSelected = row.getIsSelected();
      return (
        <tr
          key={row.id}
          aria-selected={selectable ? isSelected : undefined}
          className={cn(
            "border-border hover:bg-surface-subtle border-b last:border-0",
            isSelected && "bg-primary-subtle/40",
            tone === "danger" && "shadow-[inset_3px_0_0_var(--color-danger)]",
            tone === "warning" && "shadow-[inset_3px_0_0_var(--color-warning)]",
            tone === "info" && "shadow-[inset_3px_0_0_var(--color-info)]",
          )}
        >
          {selectable ? (
            <td className={cn(cellPadding, "w-10")}>
              <input
                type="checkbox"
                className="accent-primary size-4 align-middle"
                checked={isSelected}
                onChange={row.getToggleSelectedHandler()}
                aria-label={labels?.selectRow(getRowName?.(row.original) ?? row.id)}
              />
            </td>
          ) : null}
          {row.getVisibleCells().map((cell) => {
            const column = columnById.get(cell.column.id);
            return (
              <td
                key={cell.id}
                className={cn(
                  cellPadding,
                  "align-middle",
                  column?.numeric && "text-end tabular-nums",
                  column?.className,
                )}
              >
                <table.FlexRender cell={cell} />
              </td>
            );
          })}
        </tr>
      );
    });
  }

  const allSelected = hasRows && table.getIsAllRowsSelected();
  const someSelected = table.getIsSomeRowsSelected();

  return (
    <div
      className={cn("border-border bg-surface relative max-h-[72dvh] overflow-auto rounded-lg border", className)}
      aria-busy={loading || undefined}
    >
      <table className={cn("w-full border-collapse text-sm", loading && hasRows && "opacity-60")}>
        <caption className={cn(showCaption ? "text-muted px-3 py-2 text-start text-sm" : "sr-only")}>{caption}</caption>
        <thead className="bg-surface-subtle sticky top-0">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-border border-b">
              {selectable ? (
                <th scope="col" className={cn(cellPadding, "w-10")}>
                  <input
                    type="checkbox"
                    className="accent-primary size-4 align-middle"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    disabled={!hasRows}
                    aria-label={labels?.selectAll}
                  />
                </th>
              ) : null}
              {group.headers.map((header) => {
                const column = columnById.get(header.column.id);
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={cn(
                      cellPadding,
                      "text-muted text-start text-xs font-medium whitespace-nowrap",
                      column?.numeric && "text-end",
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "hover:text-fg inline-flex items-center gap-1 rounded-sm",
                          column?.numeric && "flex-row-reverse",
                          sorted && "text-fg",
                        )}
                      >
                        {labels ? <span className="sr-only">{labels.sortBy}</span> : null}
                        <table.FlexRender header={header} />
                        <Icon
                          name={sorted === "asc" ? "sort-asc" : sorted === "desc" ? "sort-desc" : "sort"}
                          size={14}
                          className={cn(!sorted && "opacity-40")}
                        />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
