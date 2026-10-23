import { describe, expect, it } from "vitest";

import { code128Modules, ean8Modules, upcaModules, gs1CheckDigit, CODE128_QUIET } from "./codes";
import { blockElements, wrapText, type BlockWords } from "./datablocks";

const measure = (text: string, size: number) => text.length * size * 0.5;
const WORDS: BlockWords = {
  title: { ingredients: "ส่วนประกอบ", nutrition: "ข้อมูลโภชนาการ", manufacturer: "ผู้ผลิต" },
  serving: "หนึ่งหน่วยบริโภค",
  energy: "พลังงาน",
  fat: "ไขมัน",
  sugar: "น้ำตาล",
  sodium: "โซเดียม",
  phone: "โทร.",
  fda: "เลขสารบบอาหาร",
};

describe("Thai line breaking (U4.4 data blocks)", () => {
  it("breaks between Thai words, never inside one, within the width", () => {
    const text = "แป้งสาลีน้ำตาลเนยสดไข่ไก่และเกลือเล็กน้อย";
    const lines = wrapText(text, 20, 2, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
    const words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map((s) => s.segment);
    for (const line of lines) {
      expect(measure(line, 2)).toBeLessThanOrEqual(20 + 2);
      // Every line starts at a word boundary.
      let at = 0;
      const starts = new Set(words.map((w) => ((at += w.length), at - w.length)));
      expect(starts.has(text.indexOf(line))).toBe(true);
    }
  });

  it("sets a nutrition block as a grouped bold title and its lines", () => {
    const els = blockElements(
      {
        kind: "nutrition",
        facts: { serving: "30 ก.", energyKcal: "120 กิโลแคลอรี", fatG: "5 ก.", sugarG: "8 ก.", sodiumMg: "90 มก." },
      },
      WORDS,
      { x: 10, y: 10 },
      { widthMm: 60, fontSizeMm: 2, fontFamily: "Sarabun", fill: "#000000", groupId: "g1", measure },
    );
    expect(els).toHaveLength(2);
    expect(els.every((e) => e.groupId === "g1")).toBe(true);
    expect(els[0]!.type === "text" && els[0]!.fontStyle).toBe("bold");
    expect(els[1]!.type === "text" && els[1]!.text).toContain("พลังงาน 120 กิโลแคลอรี");
  });
});

describe("barcodes (U4.4, D-283)", () => {
  it("draws EAN-8, UPC-A and Code 128 with their check digits and quiet zones", () => {
    expect(gs1CheckDigit("9638507")).toBe(4);
    expect(ean8Modules("9638507")).toBe(ean8Modules("96385074"));
    expect(ean8Modules("96385074")!.length).toBe(7 + 67 + 7);
    expect(ean8Modules("96385075")).toBeNull();
    expect(upcaModules("03600029145")!.length).toBe(9 + 95 + 9);
    expect(upcaModules("036000291453")).toBeNull();
    const c = code128Modules("getpack-1")!;
    expect(c.length).toBe(2 * CODE128_QUIET + 11 * (9 + 2) + 13);
    expect(c.slice(CODE128_QUIET, CODE128_QUIET + 11)).toBe("11010010000"); // start B
    expect(code128Modules("ก")).toBeNull();
  });
});
