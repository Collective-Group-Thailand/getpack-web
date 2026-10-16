import type { ReactNode } from "react";

import { cn } from "@/ui/lib/cn";

/**
 * The account's list table (UX pass 2026-10-16: "some things should be tables, not cards").
 *
 * One real `<table>` with a caption and `scope` on every header, so a screen reader and a
 * customer scanning twenty orders both get rows and columns. On a phone the same markup is
 * stacked: the header row is hidden, each row becomes a bordered block and each cell shows its
 * own column label beside the value — no sideways scroll, nothing a cell loses. A server
 * component: pages pass ready-made cells; nothing here fetches, sorts or formats.
 */
export interface PortalColumn {
  key: string;
  label: ReactNode;
  /** Right-aligned with tabular figures: money, quantities, dates that line up. */
  numeric?: boolean;
  /** Shown only to screen readers on wide screens (an actions column), and never on a phone. */
  srOnly?: boolean;
  /** Not shown on a phone (the desktop already repeats it in the first cell, say). */
  hideOnPhone?: boolean;
  className?: string;
}

export interface PortalRow {
  id: string;
  /** The row's cells by column key; a missing one renders empty. */
  cells: Record<string, ReactNode>;
  /** On a phone the first cell is the block's heading; a second line under it, if any. */
  phoneSubtitle?: ReactNode;
}

export function PortalTable({
  caption,
  columns,
  rows,
  className,
}: {
  caption: string;
  columns: readonly PortalColumn[];
  rows: readonly PortalRow[];
  className?: string;
}) {
  const [first, ...rest] = columns;
  if (!first) return null;
  return (
    <div className={cn("border-border bg-surface rounded-card border md:overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-subtle text-muted hidden text-xs md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2.5 font-medium first:ps-4 last:pe-4",
                  column.numeric ? "text-end" : "text-start",
                  column.className,
                )}
              >
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {rows.map((row) => (
            <tr key={row.id} className="border-border block border-t first:border-t-0 md:table-row md:first:border-t">
              <th
                scope="row"
                className="block px-4 pt-4 pb-1 text-start font-medium md:table-cell md:py-3.5 md:align-top"
              >
                {row.cells[first.key]}
                {row.phoneSubtitle ? (
                  <span className="text-muted mt-0.5 block text-xs font-normal md:hidden">{row.phoneSubtitle}</span>
                ) : null}
              </th>
              {rest.map((column, index) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 md:table-cell md:px-3 md:py-3.5 md:align-top md:last:pe-4",
                    column.hideOnPhone ? "hidden" : "flex items-baseline justify-between gap-4 py-1",
                    column.srOnly ? "pt-3 pb-4 md:pt-3.5 md:pb-3.5" : "",
                    index === rest.length - 1 && !column.srOnly ? "pb-4 md:pb-3.5" : "",
                    column.numeric ? "md:text-end md:tabular-nums" : "",
                    column.className,
                  )}
                >
                  {column.srOnly ? null : <span className="text-muted shrink-0 text-xs md:hidden">{column.label}</span>}
                  <span
                    className={cn(
                      "min-w-0 md:contents",
                      column.numeric ? "tabular-nums max-md:text-end" : "max-md:text-end",
                    )}
                  >
                    {row.cells[column.key]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
