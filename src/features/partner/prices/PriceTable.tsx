import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { cn } from "@/ui/lib/cn";

import { lineLabeller } from "./LineList";
import {
  columnsOf,
  isEmptyValue,
  pairDimensions,
  rangeLabel,
  rangeText,
  sortRows,
  type DimensionColumn,
  type PriceComponentDef,
  type PriceReference,
  type Values,
} from "./values";

type Row = Schemas["PriceRowDto"];
type Column = Schemas["PriceColumnDto"];

const NUMERIC: readonly Schemas["PriceColumnType"][] = ["decimal", "integer"];

/**
 * One component of a price-list version as a read-only table: what a line applies to first and
 * shaded — each from/to pair read as one range ("0–20", "ทุกค่า"), so the prices stay on screen —
 * then the prices and values a proposal changes, in bold, every header in words with its unit.
 * Rows come sorted by the identifying columns and can be narrowed by a search term (`q`).
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
  const pairs = pairDimensions(dimensions);
  const text = (column: Column, value: unknown) => label.cell(column, value);
  const appliesText = (pair: DimensionColumn, row: Row) =>
    pair.kind === "single"
      ? text(pair.column, (row.values as Values)[pair.column.key])
      : rangeText(pair, row.values as Values, text, t("table.anyRange"));
  const appliesLabel = (pair: DimensionColumn) =>
    pair.kind === "single" ? label.column(pair.column.key) : rangeLabel(label.column(pair.lower.key));
  // A range open at both ends on every line says nothing ("ทุกค่า" everywhere): left out of the table, named once below it.
  const any = t("table.anyRange");
  const everywhereAny = pairs.filter(
    (pair) => pair.kind === "range" && rows.length > 0 && rows.every((row) => appliesText(pair, row) === any),
  );
  const applies = pairs.filter((pair) => !everywhereAny.includes(pair));
  // Many conditions side by side push the prices off screen: past three they stack in one column instead.
  const stacked = applies.length > 3;
  const headApplies = stacked ? [] : applies;
  const needle = query?.trim().toLocaleLowerCase();
  const sorted = sortRows(rows, dimensions, text);
  const shown = needle
    ? sorted.filter((row) =>
        [...applies.map((pair) => appliesText(pair, row)), ...values.map((c) => text(c, (row.values as Values)[c.key]))]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
      )
    : sorted;
  const caption = t("rowsCaption", { component: tComponents(component) });
  const someEmpty = shown.some((row) => values.some((column) => isEmptyValue((row.values as Values)[column.key])));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm" aria-live="polite">
        {needle
          ? t("table.filtered", { shown: shown.length, total: rows.length })
          : t("table.count", { total: rows.length })}
      </p>
      {shown.length ? (
        <>
          {/* A phone gets one card per line — what it applies to, then its prices — not a table wider than the screen. */}
          <ul
            className="border-border bg-surface divide-border divide-y rounded-xl border sm:hidden"
            aria-label={caption}
          >
            {shown.map((row) => (
              <li key={row.lineKey} className="flex flex-col gap-2 px-4 py-3">
                <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                  {applies.map((pair) => (
                    <div key={pair.key} className="flex gap-1">
                      <dt className="text-muted">{appliesLabel(pair)}</dt>
                      <dd>{appliesText(pair, row)}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="bg-sage-subtle grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-lg p-2 text-sm tabular-nums">
                  {values.map((column) => {
                    const value = (row.values as Values)[column.key];
                    return (
                      <div key={column.key} className="contents">
                        <dt className="text-muted">{label.column(column.key)}</dt>
                        <dd className={cn("text-end", isEmptyValue(value) ? "text-muted" : "font-semibold")}>
                          {text(column, value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
          <div
            className="border-border bg-surface hidden max-h-[70vh] overflow-auto rounded-xl border sm:block"
            // Scrolls both ways: focusable, so a keyboard can scroll it too.
            tabIndex={0}
            role="region"
            aria-label={caption}
          >
            <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
              <caption className="sr-only">{caption}</caption>
              <thead className="sticky top-0 z-10">
                {!stacked && applies.length && values.length ? (
                  <tr className="text-xs">
                    <th
                      scope="colgroup"
                      colSpan={stacked ? 1 : applies.length}
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
                  {stacked ? (
                    <th
                      scope="col"
                      className="bg-surface-subtle border-border border-b px-3 py-2 text-start align-bottom font-medium"
                    >
                      {t("table.dimensions")}
                    </th>
                  ) : null}
                  {headApplies.map((pair) => (
                    <th
                      key={pair.key}
                      scope="col"
                      className="bg-surface-subtle border-border border-b px-3 py-2 text-start align-bottom font-medium"
                    >
                      <span className="block min-w-16">{appliesLabel(pair)}</span>
                    </th>
                  ))}
                  {values.map((column, index) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "bg-sage-subtle border-border border-b px-3 py-2 align-bottom font-medium",
                        index === 0 && "border-s",
                        NUMERIC.includes(column.type) ? "text-end" : "text-start",
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
                    {stacked ? (
                      <td className="border-border border-b px-3 py-2 align-top">
                        <dl className="grid min-w-56 grid-cols-[auto_1fr] gap-x-2 text-xs">
                          {applies.map((pair) => (
                            <div key={pair.key} className="contents">
                              <dt className="text-muted">{appliesLabel(pair)}</dt>
                              <dd className="text-fg">{appliesText(pair, row)}</dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                    ) : null}
                    {headApplies.map((pair) => (
                      <td
                        key={pair.key}
                        // Names may wrap (a machine name); ranges and numbers stay on one line.
                        className={cn(
                          "border-border text-fg border-b px-3 py-2",
                          pair.kind === "range" || NUMERIC.includes(pair.column.type)
                            ? "whitespace-nowrap"
                            : "min-w-28",
                        )}
                      >
                        {appliesText(pair, row)}
                      </td>
                    ))}
                    {values.map((column, index) => {
                      const value = (row.values as Values)[column.key];
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "border-border border-b px-3 py-2 whitespace-nowrap",
                            isEmptyValue(value) ? "text-muted" : "font-semibold",
                            index === 0 && "border-s",
                            NUMERIC.includes(column.type) && "text-end",
                          )}
                        >
                          {text(column, value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {everywhereAny.length ? (
            <p className="text-muted text-xs">
              {t("table.anyEverywhere", { columns: everywhereAny.map(appliesLabel).join(", ") })}
            </p>
          ) : null}
          {someEmpty ? <p className="text-muted text-xs">{t("table.emptyValue")}</p> : null}
        </>
      ) : (
        <p className="border-border text-muted rounded-xl border border-dashed p-6 text-center">
          {needle ? t("table.noMatch", { query: query!.trim() }) : t("noRows", { component: tComponents(component) })}
        </p>
      )}
    </div>
  );
}
