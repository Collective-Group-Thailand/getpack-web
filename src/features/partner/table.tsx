import Link from "next/link";

import { cn } from "@/ui/lib/cn";

export interface Column<R> {
  key: string;
  header: React.ReactNode;
  cell: (row: R) => React.ReactNode;
  /** Numbers and money read right-aligned so their digits line up. */
  align?: "start" | "end";
  /** The column that names the row: the link on a desk, the card's title on a phone. */
  primary?: boolean;
  /** Left out of the phone card (still in the table). */
  hideOnPhone?: boolean;
  className?: string;
}

/**
 * Records the factory compares — jobs, bills, claims, shipments, payouts, users — as a real table on
 * a desk (one row each, columns that line up, a header that says what each column is) and, on a
 * phone, as one card per record whose every value keeps its column's name. When `rowHref` is given
 * the whole row opens the record (one link in the primary cell, stretched over the row).
 */
export function PartnerTable<R>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  rowTone,
  empty,
}: {
  caption: string;
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  rowHref?: (row: R) => string;
  /** A row that needs the reader first (a claim to answer, a late job) gets a tinted edge. */
  rowTone?: (row: R) => "danger" | "warning" | undefined;
  empty?: React.ReactNode;
}) {
  if (!rows.length) return empty ? <>{empty}</> : null;
  const primary = columns.find((column) => column.primary) ?? columns[0]!;
  const rest = columns.filter((column) => column !== primary && !column.hideOnPhone);
  const edge = (row: R) => {
    const tone = rowTone?.(row);
    return tone === "danger" ? "border-s-danger" : tone === "warning" ? "border-s-warning" : "border-s-transparent";
  };
  const primaryCell = (row: R) =>
    rowHref ? (
      <Link
        href={rowHref(row)}
        className="font-medium underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:outline-none"
      >
        {primary.cell(row)}
      </Link>
    ) : (
      primary.cell(row)
    );

  return (
    <>
      <div className="border-border bg-surface hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full border-collapse text-start text-[0.9375rem] tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-border bg-surface-subtle border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "text-muted px-3 py-2.5 text-sm font-medium whitespace-nowrap first:ps-4 last:pe-4",
                    column.align === "end" ? "text-end" : "text-start",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  "border-border relative border-s-[3px] border-b last:border-b-0",
                  edge(row),
                  rowHref && "hover:bg-surface-subtle focus-within:bg-surface-subtle cursor-pointer",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-3 align-middle first:ps-4 last:pe-4",
                      column.align === "end" ? "text-end whitespace-nowrap" : "text-start",
                      column.className,
                    )}
                  >
                    {column === primary ? primaryCell(row) : column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn("border-border bg-surface relative rounded-xl border border-s-[3px] px-4 py-3", edge(row))}
          >
            <p className="text-[1.0625rem]">{primaryCell(row)}</p>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
              {rest.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-muted">{column.header}</dt>
                  <dd className={cn(column.align === "end" && "tabular-nums")}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
