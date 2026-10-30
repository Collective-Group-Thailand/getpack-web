import { describe, expect, it } from "vitest";

import { isPlaceholderIssuer, realIssuer } from "./issuer";

const real = {
  legalNameTh: "บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด",
  legalNameEn: null,
  taxId: "0105567000000",
  branchCode: "00000",
  addressTh: "กรุงเทพมหานคร",
} as never;

describe("the issuer on the contact page", () => {
  it("treats the seed's stand-ins as placeholders: an all-zero tax id or a name marked fake", () => {
    expect(isPlaceholderIssuer({ ...(real as object), taxId: "0000000000000" } as never)).toBe(true);
    expect(isPlaceholderIssuer({ ...(real as object), legalNameTh: "บริษัท ทดสอบ จำกัด (ข้อมูลปลอม)" } as never)).toBe(
      true,
    );
    expect(realIssuer({ ...(real as object), addressTh: "99/9 ถนนทดสอบ (ข้อมูลปลอม)" } as never)).toBeNull();
  });

  it("keeps real settings as they are", () => {
    expect(isPlaceholderIssuer(real)).toBe(false);
    expect(realIssuer(real)).toBe(real);
    expect(realIssuer(null)).toBeNull();
  });
});
