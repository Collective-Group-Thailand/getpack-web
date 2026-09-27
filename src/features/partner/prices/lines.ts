import type { Schemas } from "@/lib/api/types";

import { csvField } from "./sheet";
import { columnsOf, type PriceComponentDef, type Values } from "./values";

export type LineInput = Schemas["PriceProposalLineInput"];

export interface SheetProblem {
  /** 1-based row in the sheet, header included — the number Excel shows. */
  row: number;
  column: string;
  code: "unknown_component" | "bad_action" | "required" | "not_integer" | "not_decimal" | "not_boolean";
}

const ACTIONS = ["add", "change", "remove"] as const;

/** A cell as the column's type wants it, or an error code. Decimals stay strings. */
function typed(raw: string, column: Schemas["PriceColumnDto"]): { value: unknown } | { error: SheetProblem["code"] } {
  const text = raw.trim();
  if (text === "") return column.nullable ? { value: null } : { error: "required" };
  switch (column.type) {
    case "integer":
      return /^-?\d+$/.test(text) ? { value: Number(text) } : { error: "not_integer" };
    case "decimal": {
      const normal = text.replace(/,/g, "");
      if (!/^-?\d+(\.\d+)?$/.test(normal)) return { error: "not_decimal" };
      const [whole, fraction = ""] = normal.split(".");
      const scale = column.scale ?? fraction.length;
      return { value: scale ? `${whole}.${fraction.padEnd(scale, "0").slice(0, scale)}` : whole };
    }
    case "boolean":
      return /^(true|false|1|0|yes|no)$/i.test(text)
        ? { value: /^(true|1|yes)$/i.test(text) }
        : { error: "not_boolean" };
    default:
      return { value: text };
  }
}

/**
 * Rows of an uploaded price sheet → proposal lines, with every problem found rather than the
 * first. The header names the columns: `component`, `action` (add · change · remove), an
 * optional `lineKey`, then the component's own columns by key. A `change` or `remove` finds its
 * line by `lineKey`, or by its identifying columns when the key is blank.
 */
export function sheetToLines(
  rows: string[][],
  definitions: PriceComponentDef[],
): { lines: LineInput[]; problems: SheetProblem[] } {
  const [header = [], ...body] = rows;
  const at = (name: string) => header.findIndex((cell) => cell.trim() === name);
  const componentAt = at("component");
  const actionAt = at("action");
  const keyAt = at("lineKey");
  const lines: LineInput[] = [];
  const problems: SheetProblem[] = [];
  body.forEach((cells, index) => {
    const row = index + 2;
    const component = (cells[componentAt] ?? "").trim() as Schemas["PriceComponent"];
    const action = (cells[actionAt] ?? "").trim().toLowerCase() as LineInput["action"];
    const columns = columnsOf(definitions, component);
    if (!columns.all.length) return problems.push({ row, column: "component", code: "unknown_component" });
    if (!(ACTIONS as readonly string[]).includes(action))
      return problems.push({ row, column: "action", code: "bad_action" });
    const lineKey = keyAt >= 0 ? (cells[keyAt] ?? "").trim() : "";
    const wanted = action === "remove" ? (lineKey ? [] : columns.dimensions) : columns.all;
    const values: Values = {};
    let ok = true;
    for (const column of wanted) {
      const position = at(column.key);
      const result = typed(position >= 0 ? (cells[position] ?? "") : "", column);
      if ("error" in result) {
        problems.push({ row, column: column.key, code: result.error });
        ok = false;
      } else values[column.key] = result.value;
    }
    if (ok) lines.push({ action, component, ...(lineKey ? { lineKey } : {}), ...(wanted.length ? { values } : {}) });
  });
  return { lines, problems };
}

/**
 * The current rows of one component as a CSV to edit in Excel and upload back: one `change`
 * line per row, identified by its `lineKey`. With a BOM, so Excel reads Thai as UTF-8.
 */
export function templateCsv(
  component: Schemas["PriceComponent"],
  definitions: PriceComponentDef[],
  rows: { lineKey: string; values: Values }[],
): string {
  const columns = columnsOf(definitions, component).all.map((column) => column.key);
  const header = ["component", "action", "lineKey", ...columns];
  const body = rows.map((row) => [
    component,
    "change",
    row.lineKey,
    ...columns.map((key) => String(row.values[key] ?? "")),
  ]);
  const empty = [[component, "add", "", ...columns.map(() => "")]];
  return `﻿${[header, ...body, ...empty].map((cells) => cells.map(csvField).join(",")).join("\r\n")}\r\n`;
}

/** A line already on a draft, as the input that replaces the draft's lines again. */
export function lineToInput(line: Schemas["PriceProposalLineDto"]): LineInput {
  return {
    action: line.action,
    component: line.component,
    lineKey: line.lineKey,
    ...(line.action === "remove" ? {} : { values: (line.proposedValues ?? {}) as Values }),
  };
}
