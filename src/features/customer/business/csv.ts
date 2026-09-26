/**
 * The bulk reorder CSV (F3 3.7): one order number per line, optionally a quantity after a comma,
 * semicolon or tab. A header line is skipped; blank lines are ignored. What does not read as a
 * row is returned with its line number, so the page can say which line to fix. The API checks
 * every row again — this only turns a file into rows.
 */
export interface ReorderCsvRow {
  line: number;
  orderCode: string;
  quantity: number | null;
}

export function parseReorderCsv(text: string): { rows: ReorderCsvRow[]; errors: { line: number; value: string }[] } {
  const rows: ReorderCsvRow[] = [];
  const errors: { line: number; value: string }[] = [];
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const value = raw.trim();
      if (!value) return;
      const [code = "", quantity = ""] = value.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
      if (index === 0 && !/\d/.test(code)) return;
      if (!/^[A-Za-z]{1,4}-?\d{2,4}-?[A-Za-z0-9]{3,8}$/.test(code) || (quantity && !/^\d+$/.test(quantity))) {
        errors.push({ line: index + 1, value });
        return;
      }
      rows.push({ line: index + 1, orderCode: code.toUpperCase(), quantity: quantity ? Number(quantity) : null });
    });
  return { rows, errors };
}
