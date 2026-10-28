import { describe, expect, it } from "vitest";

import { specsOf } from "./specs";

const option = (nameTh: string, attributes: Record<string, unknown> = {}) => ({
  id: nameTh,
  code: nameTh,
  nameTh,
  nameEn: nameTh,
  descriptionTh: null,
  descriptionEn: null,
  imageUrl: null,
  swatchHex: null,
  isDefault: false,
  attributes,
});

describe("specsOf (row / comparison facts from the API only)", () => {
  it("reads structure, flutes, boards and sizes", () => {
    const specs = specsOf(
      {
        patterns: [
          {
            code: "RSC",
            name: "กล่องฝาชน (RSC)",
            styleCode: null,
            internationalName: null,
            dielineKey: null,
            constraints: {},
          },
          {
            code: "RSC2",
            name: "กล่องฝาชน (RSC)",
            styleCode: null,
            internationalName: null,
            dielineKey: null,
            constraints: {},
          },
        ],
        optionGroups: [
          {
            kind: "material",
            options: [
              option("KA125 ลอน B (3 ชั้น)", { flute: "UAT-B" }),
              option("ลอน BC (5 ชั้น)"),
              option("อาร์ตการ์ด"),
            ],
          },
          { kind: "finish", options: [option("เคลือบด้าน")] },
        ],
        standardSizes: [
          { code: "00", name: "เบอร์ 00", lengthMm: 140, widthMm: 97.5, heightMm: 60 },
          { code: "0", name: "เบอร์ 0", lengthMm: 170, widthMm: 110, heightMm: 60 },
        ],
      } as never,
      true,
    );
    expect(specs).toEqual({
      structures: ["กล่องฝาชน (RSC)"],
      flutes: ["B", "BC"],
      materials: [
        { th: "KA125 ลอน B (3 ชั้น)", en: "KA125 ลอน B (3 ชั้น)" },
        { th: "ลอน BC (5 ชั้น)", en: "ลอน BC (5 ชั้น)" },
        { th: "อาร์ตการ์ด", en: "อาร์ตการ์ด" },
      ],
      standardSizes: 2,
      customSize: true,
    });
  });

  it("says nothing it does not know", () => {
    expect(specsOf(null, true)).toBeNull();
    expect(specsOf({ patterns: [], optionGroups: [], standardSizes: [] } as never, false)).toEqual({
      structures: [],
      flutes: [],
      materials: [],
      standardSizes: 0,
      customSize: false,
    });
  });
});
