/**
 * CSV exports of the finance reports. The cells are the API's own strings — money stays the
 * decimal string it was, dates their ISO form — so an export says exactly what the screen read;
 * nothing is added up or reformatted here. UTF-8 with a BOM and CRLF, as the backend's tax
 * exports are, so spreadsheet tools open Thai text correctly.
 */

export type CsvCell = string | number | boolean | null | undefined;

const field = (value: CsvCell) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv<Row>(
  columns: readonly { header: string; value: (row: Row) => CsvCell }[],
  rows: readonly Row[],
): string {
  const lines = [
    columns.map((column) => field(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => field(column.value(row))).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
