import { cn } from "../lib/cn";

export interface PriceRow {
  label: React.ReactNode;
  /** Already formatted — `src/ui` never formats money (`formatTHB` belongs to `src/i18n`). */
  value: React.ReactNode;
  /** Small print under the label: "ชำระครั้งเดียว", "รวมในราคาต่อชิ้นแล้ว". */
  hint?: React.ReactNode;
  tone?: "default" | "discount" | "muted";
}

export interface PriceSummaryProps {
  rows: PriceRow[];
  total: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode };
  /** Under the total: validity, tolerance, what is not included. */
  footnote?: React.ReactNode;
  /** Names the list for assistive technology, e.g. "สรุปราคา". */
  "aria-label"?: string;
  className?: string;
}

/**
 * Lines, VAT and the total — every amount the API returned, in the order a customer reads a bill
 * (design-system.md §1.3 "honest pricing": VAT and one-off costs are always their own lines).
 *
 * A description list, so a screen reader pairs each label with its amount. Figures are tabular
 * and end-aligned so a column of money lines up. It shows; it never adds anything up.
 */
export function PriceSummary({ rows, total, footnote, className, ...props }: PriceSummaryProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <dl aria-label={props["aria-label"]} className="flex flex-col gap-2 text-sm">
        {rows.map((row, index) => (
          <div key={index} className="flex items-start justify-between gap-4">
            <dt className={cn("min-w-0", row.tone === "muted" && "text-muted")}>
              {row.label}
              {row.hint ? <span className="text-muted block text-xs">{row.hint}</span> : null}
            </dt>
            <dd
              className={cn(
                "shrink-0 text-end tabular-nums",
                row.tone === "discount" && "text-success-subtle-fg font-medium",
                row.tone === "muted" && "text-muted",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
        <div className="border-border flex items-start justify-between gap-4 border-t pt-3">
          <dt className="font-semibold">
            {total.label}
            {total.hint ? <span className="text-muted block text-xs font-normal">{total.hint}</span> : null}
          </dt>
          <dd className="shrink-0 text-end text-lg font-bold tabular-nums">{total.value}</dd>
        </div>
      </dl>
      {footnote ? <div className="text-muted text-xs">{footnote}</div> : null}
    </div>
  );
}

export interface PriceBreakRow {
  key: string;
  quantity: React.ReactNode;
  perPiece: React.ReactNode;
  total: React.ReactNode;
  leadTime?: React.ReactNode;
  selected?: boolean;
  /** Why this quantity has no instant price — the row stays, explained, instead of vanishing. */
  unavailable?: React.ReactNode;
}

export interface PriceBreakTableProps {
  caption: React.ReactNode;
  headers: { quantity: React.ReactNode; perPiece: React.ReactNode; total: React.ReactNode; leadTime?: React.ReactNode };
  rows: PriceBreakRow[];
  /** Makes each row choosable; the button's accessible name comes from `selectLabel`. */
  onSelect?: (key: string) => void;
  selectLabel?: (row: PriceBreakRow) => string;
  /** "เลือกอยู่" — the text of the chosen row's button. */
  selectedText?: React.ReactNode;
  /** "เลือก" */
  selectText?: React.ReactNode;
  className?: string;
}

/**
 * Price per quantity (design-system.md §3 "PriceBreakTable"): how the per-piece price falls as
 * the run grows, from the API's own figures. The chosen quantity is marked with a border and the
 * word "เลือกอยู่", not colour alone.
 */
export function PriceBreakTable({
  caption,
  headers,
  rows,
  onSelect,
  selectLabel,
  selectedText,
  selectText,
  className,
}: PriceBreakTableProps) {
  const cell = "px-3 py-2";
  return (
    <div className={cn("border-border overflow-x-auto rounded-xl border", className)}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-bg-subtle text-muted text-xs">
          <tr>
            <th scope="col" className={cn(cell, "text-start font-medium")}>
              {headers.quantity}
            </th>
            <th scope="col" className={cn(cell, "text-end font-medium")}>
              {headers.perPiece}
            </th>
            <th scope="col" className={cn(cell, "text-end font-medium")}>
              {headers.total}
            </th>
            {headers.leadTime ? (
              <th scope="col" className={cn(cell, "hidden text-end font-medium sm:table-cell")}>
                {headers.leadTime}
              </th>
            ) : null}
            {onSelect ? (
              <th scope="col" className={cell}>
                <span className="sr-only">{selectText}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "border-border border-t",
                row.selected && "bg-primary-subtle outline-primary outline-2 -outline-offset-2",
              )}
            >
              <th scope="row" className={cn(cell, "text-start font-medium tabular-nums")}>
                {row.quantity}
              </th>
              {row.unavailable ? (
                <td colSpan={headers.leadTime ? 3 : 2} className={cn(cell, "text-muted text-end text-xs")}>
                  {row.unavailable}
                </td>
              ) : (
                <>
                  <td className={cn(cell, "text-end tabular-nums")}>{row.perPiece}</td>
                  <td className={cn(cell, "text-end tabular-nums")}>{row.total}</td>
                  {headers.leadTime ? (
                    <td className={cn(cell, "text-muted hidden text-end sm:table-cell")}>{row.leadTime}</td>
                  ) : null}
                </>
              )}
              {onSelect ? (
                <td className={cn(cell, "text-end")}>
                  {row.unavailable ? null : (
                    <button
                      type="button"
                      aria-pressed={Boolean(row.selected)}
                      aria-label={selectLabel?.(row)}
                      onClick={() => onSelect(row.key)}
                      className={cn(
                        "min-h-8 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap",
                        row.selected
                          ? "border-primary text-primary-subtle-fg"
                          : "border-border-strong hover:bg-bg-subtle",
                      )}
                    >
                      {row.selected ? selectedText : selectText}
                    </button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
