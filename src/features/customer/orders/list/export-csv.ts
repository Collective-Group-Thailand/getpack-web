import type { Schemas } from "@/lib/api/types";

type Group = Schemas["OrderGroupDto"];

/** One CSV cell: quoted when it holds a comma, a quote or a line break; a leading formula sign is neutralised. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A cell starting with = + - @ is read as a formula by spreadsheets (CSV injection).
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ExportColumns {
  headers: string[];
  row: (group: Group, order: Group["orders"][number]) => (string | number | null)[];
}

/**
 * The orders list as CSV (account pack Phase 2 item 1): one line per order, in the list's order, the API's own
 * figures — the amount stays the API's decimal string (no arithmetic, no rounding) so Excel sums it as a number.
 * Starts with a UTF-8 BOM so Excel reads the Thai words.
 */
export function ordersCsv(groups: Group[], columns: ExportColumns): string {
  const lines = [columns.headers, ...groups.flatMap((group) => group.orders.map((order) => columns.row(group, order)))];
  return `﻿${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
