import Link from "next/link";

import { cn } from "@/ui/lib/cn";

export interface StatementRow {
  key: string;
  label: React.ReactNode;
  /** Already formatted, as the API sent it — a statement never adds anything up on the page. */
  amount?: React.ReactNode;
  comparative?: React.ReactNode;
  /** 0 a section heading or a result, 1 a line of the statement, 2 an account under a line. */
  level?: 0 | 1 | 2;
  /**
   * `heading` a section's name; `line` an ordinary figure; `subtotal` a section's total under a short rule over the
   * figures; `total` the statement's result under a rule and over a double rule.
   */
  kind?: "heading" | "line" | "subtotal" | "total";
  href?: string;
}

const INDENT = { 0: "ps-4 sm:ps-5", 1: "ps-7 sm:ps-9", 2: "ps-10 sm:ps-13" } as const;

/**
 * A financial statement as an accountant prints it (profit and loss, financial position, cash flow, the ภ.พ.30
 * summary): a heading per section, its lines indented under it, figures right-aligned in tabular numerals, a short
 * rule over each subtotal and a double rule under the result. A real table, so the columns read across.
 */
export function Statement({
  caption,
  title,
  period,
  status,
  headers,
  rows,
}: {
  caption: string;
  title?: React.ReactNode;
  /** The dates the statement covers ("1 – 31 ต.ค. 2569", "ณ วันที่ …"). */
  period?: React.ReactNode;
  /** A balance check beside the title. */
  status?: React.ReactNode;
  headers: { label: React.ReactNode; amount: React.ReactNode; comparative?: React.ReactNode };
  rows: StatementRow[];
}) {
  const withComparative = headers.comparative !== undefined;
  return (
    <section className="border-border bg-surface rounded-xl border">
      {title || period || status ? (
        <header className="border-border flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {period ? <p className="text-muted text-sm tabular-nums">{period}</p> : null}
          </div>
          {status}
        </header>
      ) : null}
      <table className="w-full border-collapse tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted text-sm">
            <th scope="col" className="ps-4 pt-3 pb-1 text-start font-medium sm:ps-5">
              {headers.label}
            </th>
            <th scope="col" className="px-3 pt-3 pb-1 text-end font-medium whitespace-nowrap sm:pe-5">
              {headers.amount}
            </th>
            {withComparative ? (
              <th scope="col" className="hidden pe-5 pt-3 pb-1 text-end font-medium whitespace-nowrap sm:table-cell">
                {headers.comparative}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const kind = row.kind ?? "line";
            const level = row.level ?? (kind === "line" ? 1 : 0);
            if (kind === "heading")
              return (
                <tr key={row.key}>
                  <th
                    scope="rowgroup"
                    colSpan={withComparative ? 3 : 2}
                    className={cn("pt-5 pb-1 text-start font-semibold", INDENT[level])}
                  >
                    {row.label}
                  </th>
                </tr>
              );
            const strong = kind === "subtotal" || kind === "total";
            // The rules belong to the figures: a column with no figure on this row gets none.
            const figure = (value: React.ReactNode) =>
              cn(
                "align-bottom whitespace-nowrap",
                value != null && value !== "" && kind === "subtotal" && "border-border-strong border-t",
                value != null &&
                  value !== "" &&
                  kind === "total" &&
                  "border-border-strong border-t border-b-[3px] border-double",
              );
            return (
              <tr key={row.key} className={cn(level === 2 && "text-muted text-sm")}>
                <th
                  scope="row"
                  className={cn(
                    "py-1.5 pe-3 text-start align-bottom [overflow-wrap:break-word] break-keep",
                    strong ? "font-semibold" : "font-normal",
                    kind === "total" && "pt-3",
                    INDENT[level],
                  )}
                >
                  {row.href ? (
                    <Link href={row.href} className="hover:text-primary underline-offset-4 hover:underline">
                      {row.label}
                    </Link>
                  ) : (
                    row.label
                  )}
                </th>
                <td className="px-3 py-1.5 text-end sm:pe-5">
                  <span
                    className={cn("inline-block min-w-[7rem] py-0.5", figure(row.amount), strong && "font-semibold")}
                  >
                    {row.amount ?? ""}
                  </span>
                </td>
                {withComparative ? (
                  <td className="hidden py-1.5 pe-5 text-end sm:table-cell">
                    <span
                      className={cn(
                        "inline-block min-w-[7rem] py-0.5",
                        figure(row.comparative),
                        strong && "font-semibold",
                      )}
                    >
                      {row.comparative ?? ""}
                    </span>
                  </td>
                ) : null}
              </tr>
            );
          })}
          <tr aria-hidden>
            <td colSpan={withComparative ? 3 : 2} className="h-3" />
          </tr>
        </tbody>
      </table>
    </section>
  );
}
