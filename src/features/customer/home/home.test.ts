import { describe, expect, it } from "vitest";

import { publishableFaqs } from "@/features/customer/catalog/faq-hygiene";

import { casesOf, MIN_CASES, photosOf } from "./content.server";
import { isPackagingCategory } from "./HomeSections";
import { candidates, reconcile } from "./studio-hero";
import enHome from "@/i18n/messages/en/customer/home.json";
import thHome from "@/i18n/messages/th/customer/home.json";
import { isoBox, MATERIAL_TINT } from "./iso-box";

const photo = (id: string) => ({ url: `/v1/store/catalog/images/${id}`, alt: { th: `รูป ${id}`, en: `Photo ${id}` } });
const story = (approved: boolean, brand = "ร้านมะลิ") => ({
  approved,
  image: photo(brand),
  brand,
  province: "เชียงใหม่",
  item: { th: "กล่องฝาเสียบ", en: "Tuck-end box" },
  quantity: 500,
  days: 9,
  quote: { th: "กล่องสวยกว่าที่คิด", en: "Nicer than we hoped" },
});

describe("home CMS content (Phase 4)", () => {
  it("shows customer stories only with at least three approved", () => {
    expect(casesOf("th", { cases: [story(true, "a"), story(true, "b"), story(false, "c")] })).toEqual([]);
    const three = casesOf("th", { cases: [story(true, "a"), story(true, "b"), story(true, "c"), story(false, "d")] });
    expect(three).toHaveLength(MIN_CASES);
    expect(three[0]).toMatchObject({ brand: "a", item: "กล่องฝาเสียบ", quote: "กล่องสวยกว่าที่คิด", quantity: 500 });
    expect(casesOf("en", { cases: [story(true, "a"), story(true, "b"), story(true, "c")] })[0]!.quote).toBe(
      "Nicer than we hoped",
    );
  });

  it("drops a story without a photo or the customer's words", () => {
    const noQuote = { ...story(true, "x"), quote: "" };
    expect(casesOf("th", { cases: [story(true, "a"), story(true, "b"), noQuote] })).toEqual([]);
  });

  it("needs alt text on every photo and all five for the mosaic", () => {
    const photos = photosOf("th", {
      hero: { url: "/v1/store/catalog/images/hero" },
      mosaic: [photo("1"), photo("2"), photo("3"), photo("4")],
      quality: photo("q"),
    });
    expect(photos.hero).toBeNull();
    expect(photos.mosaic).toBeNull();
    expect(photos.quality).toEqual({ src: "/bff/v1/store/catalog/images/q", alt: "รูป q", caption: null });
    expect(photosOf("th", { mosaic: ["1", "2", "3", "4", "5"].map(photo) }).mosaic).toHaveLength(5);
  });

  it("never serves a photo from outside the API or the media store", () => {
    expect(photosOf("th", { hero: { url: "javascript:alert(1)", alt: "x" } }).hero).toBeNull();
  });
});

describe("isoBox", () => {
  it("draws three closed faces and a logo only when printed", () => {
    const plain = isoBox({ w: 18, d: 12, h: 5 }, "mailer", MATERIAL_TINT.kraft350, "none");
    expect(plain.top).toMatch(/^M.* Z$/);
    expect(plain.logo).toBeNull();
    const full = isoBox({ w: 18, d: 12, h: 5 }, "lid", MATERIAL_TINT.art350, "full");
    expect(full.logo?.fill).toBe("#f6f3ee");
    expect(full.fills.top).toBe("rgb(58,124,110)");
  });

  it("fits any size inside the panel's viewBox", () => {
    for (const size of [
      { w: 18, d: 12, h: 5 },
      { w: 10, d: 10, h: 18 },
      { w: 60, d: 2, h: 2 },
    ]) {
      const box = isoBox(size, "tuck", MATERIAL_TINT.corrE, "one");
      const numbers = [box.top, box.left, box.right]
        .join(" ")
        .match(/-?\d+(\.\d+)?/g)!
        .map(Number);
      expect(Math.max(...numbers.map(Math.abs))).toBeLessThanOrEqual(160);
    }
  });
});

describe("home data hygiene (Main board review)", () => {
  const faq = (questionTh: string, answerTh: string) => ({ questionTh, answerTh, questionEn: null, answerEn: null });
  const group = (categoryNameTh: string | null, faqs: ReturnType<typeof faq>[]) => ({
    categoryCode: categoryNameTh ? "x" : null,
    categoryNameTh,
    categoryNameEn: null,
    faqs,
  });

  it("drops [DEV] fixtures and strips decision references from FAQs", () => {
    const groups = publishableFaqs([
      group(null, [
        faq("[DEV] คำถามทดสอบ", "[DEV] คำตอบ"),
        faq("ล็อกราคากี่วัน", "15 วัน (D-051) ตามใบเสนอราคา (D-051, D-176)"),
      ]),
      group("[DEV] การสั่งซื้อ", [faq("ข้อ", "ตอบ")]),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.faqs).toEqual([faq("ล็อกราคากี่วัน", "15 วัน ตามใบเสนอราคา")]);
  });

  it("lists only packaging categories", () => {
    const category = (...codes: string[]) =>
      ({ code: "c", types: codes.map((code) => ({ code })) }) as unknown as Parameters<typeof isPackagingCategory>[0];
    expect(isPackagingCategory(category("standard_product"))).toBe(false);
    expect(isPackagingCategory(category("service", "standard_product"))).toBe(false);
    expect(isPackagingCategory(category("folding_carton", "service"))).toBe(true);
  });
});

describe("Studio hero presets (Main board review)", () => {
  const shape = (id: "mailer" | "lid" | "tuck", quantities: number[], boards: ("kraft350" | "art350" | "corrE")[]) => ({
    id,
    productSlug: id,
    catalogProductId: "00000000-0000-4000-8000-000000000001",
    patternId: "00000000-0000-4000-8000-000000000002",
    dielineKey: null,
    sizes: [{ code: "S", lengthMm: 100, widthMm: 100, heightMm: 50 }],
    boards: boards.map((board) => ({ id: board, optionId: "00000000-0000-4000-8000-000000000003" })),
    prints: [
      { id: "none" as const, inkOptionIds: [] },
      { id: "one" as const, inkOptionIds: ["00000000-0000-4000-8000-000000000004"] },
    ],
    quantities,
    quoteValidityDays: 15,
  });
  const shapes = [shape("mailer", [300, 500], ["corrE"]), shape("tuck", [500, 1000], ["kraft350", "art350"])];

  it("labels every shape and board in at most 14 characters, so a chip never overflows the panel", () => {
    for (const messages of [thHome, enHome]) {
      for (const label of [...Object.values(messages.panel.shapes), ...Object.values(messages.panel.boards)])
        // Characters as read — a Thai mark (์) sits on its letter, it is not a character of its own.
        expect([...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(label)].length).toBeLessThanOrEqual(
          14,
        );
    }
    expect(thHome.panel.shapes).toEqual({ mailer: "ไปรษณีย์", lid: "ฝาครอบ", tuck: "ฝาเสียบ" });
    expect(thHome.panel.boards).toEqual({ kraft350: "คราฟท์ 350g", art350: "อาร์ตการ์ด 350g", corrE: "ลูกฟูก E" });
  });

  it("falls back from the default to the nearest offered presets, never repeating one", () => {
    const first = {
      shape: "mailer" as const,
      sizeCode: "S",
      board: "corrE" as const,
      print: "one" as const,
      quantity: 300,
    };
    expect(candidates(first, shapes)).toEqual([
      first,
      { ...first, quantity: 500 },
      { shape: "tuck", sizeCode: "S", board: "kraft350", print: "one", quantity: 500 },
    ]);
    expect(candidates(null, [])).toEqual([]);
  });

  it("moves a choice the new shape does not offer to that shape's own first one", () => {
    const onMailer = {
      shape: "mailer" as const,
      sizeCode: "S",
      board: "corrE" as const,
      print: "one" as const,
      quantity: 300,
    };
    expect(reconcile({ ...onMailer, shape: "tuck" }, shapes)).toEqual({
      ...onMailer,
      shape: "tuck",
      board: "kraft350",
      quantity: 500,
    });
  });
});
