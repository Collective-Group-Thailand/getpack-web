/**
 * Reads the first sheet of a spreadsheet a factory uploads — `.xlsx` from Excel or Google
 * Sheets, or `.csv` — into rows of text, in the browser, with no dependency.
 *
 * An `.xlsx` is a zip of XML parts. The browser already has what that needs: the zip's central
 * directory is a few fixed-width records, `DecompressionStream("deflate-raw")` inflates an entry,
 * and `DOMParser` reads the XML. A spreadsheet library would cost the partner zone (budget
 * 180 KB) far more than the 150 lines here, for a feature one owner uses a few times a year.
 * Loaded on demand from the proposal screen, never in the initial bundle.
 *
 * Only what a price sheet holds is supported: shared strings, inline strings, numbers and
 * booleans in the first worksheet. Formulas are read as their cached value.
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

function entries(bytes: Uint8Array): Map<string, Entry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  // The end-of-central-directory record sits in the last 64 KB + 22 bytes (after a comment).
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (view.getUint32(at, true) === EOCD) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new SheetError("not_a_workbook");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const found = new Map<string, Entry>();
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== CENTRAL) throw new SheetError("not_a_workbook");
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    found.set(name, { name, method, compressedSize, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

async function read(bytes: Uint8Array, entry: Entry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== LOCAL) throw new SheetError("not_a_workbook");
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new SheetError("unsupported");
  const stream = new Response(data).body!.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** `"C12"` → column index 2. */
function columnIndex(reference: string): number {
  let index = 0;
  for (const char of reference.replace(/\d+$/, "")) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

const textOf = (node: Element) => [...node.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("");

async function readXlsx(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = entries(bytes);
  const parser = new DOMParser();
  const shared: string[] = [];
  const strings = parts.get("xl/sharedStrings.xml");
  if (strings) {
    const doc = parser.parseFromString(await read(bytes, strings), "application/xml");
    for (const item of doc.getElementsByTagName("si")) shared.push(textOf(item));
  }
  const sheetName = [...parts.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetName) throw new SheetError("empty");
  const sheet = parser.parseFromString(await read(bytes, parts.get(sheetName)!), "application/xml");
  const rows: string[][] = [];
  for (const row of sheet.getElementsByTagName("row")) {
    const cells: string[] = [];
    let next = 0;
    for (const cell of row.getElementsByTagName("c")) {
      const reference = cell.getAttribute("r");
      const index = reference ? columnIndex(reference) : next;
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      const value =
        type === "s"
          ? (shared[Number(raw)] ?? "")
          : type === "inlineStr"
            ? textOf(cell)
            : type === "b"
              ? raw === "1"
                ? "true"
                : "false"
              : raw;
      cells[index] = value;
      next = index + 1;
    }
    rows.push(Array.from(cells, (value) => value ?? ""));
  }
  return rows;
}

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes; a BOM dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at]!;
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[at + 1] === "\n") at += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** A CSV field, quoted when it has to be. */
export const csvField = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export class SheetError extends Error {
  constructor(readonly reason: "not_a_workbook" | "unsupported" | "empty") {
    super(reason);
  }
}

export async function readSheet(file: File): Promise<string[][]> {
  const rows =
    /\.csv$/i.test(file.name) || file.type === "text/csv" ? parseCsv(await file.text()) : await readXlsx(file);
  const kept = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (kept.length === 0) throw new SheetError("empty");
  return kept;
}
