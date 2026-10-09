import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { cn } from "@/ui/lib/cn";

import { lineLabeller } from "./LineList";
import { columnsOf, sortRows, type PriceComponentDef, type PriceReference, type Values } from "./values";

type Row = Schemas["PriceRowDto"];
type Column = Schemas["PriceColumnDto"];

const NUMERIC: readonly Schemas["PriceColumnType"][] = ["decimal", "integer"];

/**
 * One component of a price-list version as a read-only table: the columns that identify a line
 * ("เงื่อนไข") first and shaded, then the prices and values a proposal changes, every header in
 * words with its unit. Rows come sorted by the identifying columns and can be narrowed by a
 * search term (`q`), matched against every cell as displayed.
 */
export async function PriceTable({
  component,
  rows,
  definitions,
  references,
  query,
}: {
  component: Schemas["PriceComponent"];
  rows: Row[];
  definitions: PriceComponentDef[];
  references: PriceReference[];
  query?: string;
}) {
  const t = await getTranslations("partnerPrices");
  const tComponents = await getTranslations("partnerPrices.components");
  const label = await lineLabeller(definitions, references);
  const { dimensions, values } = columnsOf(definitions, component);
  const text = (column: Column, value: unknown) => label.cell(column, value);
  const needle = query?.trim().toLocaleLowerCase();
  const sorted = sortRows(rows, dimensions, text);
  const shown = needle
    ? sorted.filter((row) =>
        [...dimensions, ...values].some((column) =>
          text(column, (row.values as Values)[column.key])
            .toLocaleLowerCase()
            .includes(needle),
        ),
      )
    : sorted;
  const caption = t("rowsCaption", { component: tComponents(component) });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm" aria-live="polite">
        {needle
          ? t("table.filtered", { shown: shown.length, total: rows.length })
          : t("table.count", { total: rows.length })}
      </p>
      {shown.length ? (
        <div
          className="border-border bg-surface max-h-[70vh] overflow-auto rounded-xl border"
          // Scrolls both ways: focusable, so a keyboard can scroll it too.
          tabIndex={0}
          role="region"
          aria-label={caption}
        >
          <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10">
              {dimensions.length && values.length ? (
                <tr className="text-xs">
                  <th
                    scope="colgroup"
                    colSpan={dimensions.length}
                    className="bg-surface-subtle text-muted border-border border-b px-3 pt-2 text-start font-medium"
                  >
                    {t("table.dimensions")}
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={values.length}
                    className="bg-sage-subtle text-muted border-border border-s border-b px-3 pt-2 text-start font-medium"
                  >
                    {t("table.values")}
                  </th>
                </tr>
              ) : null}
              <tr>
                {[...dimensions, ...values].map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "border-border border-b px-3 py-2 align-bottom font-medium",
                      index < dimensions.length ? "bg-surface-subtle text-start" : "bg-sage-subtle",
                      index === dimensions.length && "border-s",
                      index >= dimensions.length && NUMERIC.includes(column.type) ? "text-end" : "text-start",
                    )}
                  >
                    <span className="block min-w-20">{label.column(column.key)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.lineKey} className="hover:bg-surface-subtle">
                  {[...dimensions, ...values].map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-border border-b px-3 py-2 whitespace-nowrap",
                        index < dimensions.length ? "text-fg" : "font-medium",
                        index === dimensions.length && "border-s",
                        index >= dimensions.length && NUMERIC.includes(column.type) && "text-end",
                      )}
                    >
                      {text(column, (row.values as Values)[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-border text-muted rounded-xl border border-dashed p-6 text-center">
          {needle ? t("table.noMatch", { query: query!.trim() }) : t("noRows", { component: tComponents(component) })}
        </p>
      )}
    </div>
  );
}
