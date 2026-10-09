import { describe, expect, it } from "vitest";

import { lineToInput, sheetToLines, templateCsv } from "./lines";
import { parseCsv, readSheet } from "./sheet";
import { decimalText, type PriceComponentDef } from "./values";

const DEFINITIONS: PriceComponentDef[] = [
  {
    component: "material_prices",
    productTypeCodes: ["folding_carton"],
    group: "materials",
    dimensions: [
      { key: "materialId", type: "ref", nullable: false, scale: null },
      { key: "qtyFrom", type: "integer", nullable: false, scale: null },
      { key: "qtyTo", type: "integer", nullable: true, scale: null },
    ],
    values: [{ key: "rate", type: "decimal", nullable: false, scale: 6 }],
  },
];

/** A minimal .xlsx: a zip of the two parts the reader needs, stored or deflated. */
async function workbook(parts: Record<string, string>, deflate: boolean): Promise<File> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const raw = encoder.encode(text);
    const data = deflate
      ? new Uint8Array(
          await new Response(new Response(raw).body!.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer(),
        )
      : raw;
    const nameBytes = encoder.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, deflate ? 8 : 0, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(10, deflate ? 8 : 0, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, raw.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((total, chunk) => total + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, Object.keys(parts).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const bytes = new Uint8Array(all.reduce((total, chunk) => total + chunk.length, 0));
  let at = 0;
  for (const chunk of all) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return {
    name: "prices.xlsx",
    type: "",
    arrayBuffer: async () => bytes.buffer,
    text: async () => "",
  } as unknown as File;
}

const SHARED = `<sst><si><t>component</t></si><si><t>action</t></si><si><t>material_prices</t></si><si><t>change</t></si><si><r><t>ราคา</t></r><r><t>ใหม่</t></r></si></sst>`;
const SHEET = `<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>4</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>12.5</v></c><c r="D2" t="inlineStr"><is><t>ข้อความ</t></is></c></row>
</sheetData></worksheet>`;

describe("readSheet", () => {
  it.each([false, true])(
    "reads the first sheet of an .xlsx (deflated: %s), shared and inline strings",
    async (deflate) => {
      const file = await workbook({ "xl/sharedStrings.xml": SHARED, "xl/worksheets/sheet1.xml": SHEET }, deflate);
      expect(await readSheet(file)).toEqual([
        ["component", "action", "", "ราคาใหม่"],
        ["material_prices", "change", "12.5", "ข้อความ"],
      ]);
    },
  );

  it("parses CSV with quotes, commas, newlines and a BOM", () => {
    expect(parseCsv('\uFEFFa,"b, c","d ""e"""\r\n1,"two\nlines",3\n\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "two\nlines", "3"],
    ]);
  });
});

describe("sheetToLines", () => {
  const header = ["component", "action", "lineKey", "materialId", "qtyFrom", "qtyTo", "rate"];

  it("types each column and keeps decimals as strings at the column's scale", () => {
    const { lines, problems } = sheetToLines(
      [header, ["material_prices", "add", "", "m-1", "1000", "", "12.5"]],
      DEFINITIONS,
    );
    expect(problems).toEqual([]);
    expect(lines).toEqual([
      {
        action: "add",
        component: "material_prices",
        values: { materialId: "m-1", qtyFrom: 1000, qtyTo: null, rate: "12.500000" },
      },
    ]);
  });

  it("names every problem with its Excel row", () => {
    const { lines, problems } = sheetToLines(
      [header, ["nope", "add"], ["material_prices", "edit"], ["material_prices", "add", "", "m-1", "1,000", "", "abc"]],
      DEFINITIONS,
    );
    expect(lines).toEqual([]);
    expect(problems).toEqual([
      { row: 2, column: "component", code: "unknown_component" },
      { row: 3, column: "action", code: "bad_action" },
      { row: 4, column: "qtyFrom", code: "not_integer" },
      { row: 4, column: "rate", code: "not_decimal" },
    ]);
  });

  it("removes a line by its key alone", () => {
    expect(sheetToLines([header, ["material_prices", "remove", "k1"]], DEFINITIONS).lines).toEqual([
      { action: "remove", component: "material_prices", lineKey: "k1" },
    ]);
  });

  it("round-trips the template it hands out", () => {
    const csv = templateCsv("material_prices", DEFINITIONS, [
      { lineKey: "k1", values: { materialId: "m-1", qtyFrom: 1000, qtyTo: 4999, rate: "11.800000" } },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const { lines, problems } = sheetToLines(parseCsv(csv).slice(0, 2), DEFINITIONS);
    expect(problems).toEqual([]);
    expect(lines[0]).toMatchObject({ action: "change", lineKey: "k1", values: { rate: "11.800000", qtyTo: 4999 } });
  });

  it("turns a draft line back into the input that replaces it", () => {
    expect(
      lineToInput({
        id: "l1",
        lineKey: "k1",
        component: "material_prices",
        action: "remove",
        currentValues: { rate: "1.00" },
        proposedValues: null,
        counterValues: null,
        decision: "pending",
        decidedAt: null,
        comment: null,
      }),
    ).toEqual({ action: "remove", component: "material_prices", lineKey: "k1" });
  });
});

describe("decimalText", () => {
  it("shows the API's decimal without re-rounding it", () => {
    expect(decimalText("11.800000")).toBe("11.80");
    expect(decimalText("0.625000")).toBe("0.625");
    expect(decimalText("1200")).toBe("1200");
    expect(decimalText("0.123456")).toBe("0.123456");
  });
});
