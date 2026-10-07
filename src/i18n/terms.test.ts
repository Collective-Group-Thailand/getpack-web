import { describe, expect, it } from "vitest";

import { audienceOfPath, proofTerms } from "./terms";

// The old word, assembled so this file is not itself a hit for the repo-wide check.
const OLD = ["ปรู", "๊ฟ"].join("");

describe("proofTerms (Phase 4 §4.5)", () => {
  it("gives customers แบบตัวอย่าง and staff Proof with a space either side", () => {
    expect(proofTerms(`ไม่พบ${OLD}นี้`, "customer")).toBe("ไม่พบแบบตัวอย่างนี้");
    expect(proofTerms(`ไม่พบ${OLD}นี้`, "staff")).toBe("ไม่พบ Proof นี้");
    expect(proofTerms(`${OLD}ฉบับนี้ปิดการแสดงความเห็นแล้ว`, "staff")).toBe("Proof ฉบับนี้ปิดการแสดงความเห็นแล้ว");
    expect(proofTerms(`ส่ง${OLD} v2`, "customer")).toBe("ส่งแบบตัวอย่าง v2");
  });

  it("maps the other rejected words too, and leaves everything else alone", () => {
    expect(proofTerms("รอตัวอย่างงานพิมพ์", "staff")).toBe("รอ Proof");
    expect(proofTerms("ส่งพิสูจน์อักษรแล้ว", "customer")).toBe("ส่งแบบตัวอย่างแล้ว");
    expect(proofTerms("ชำระเงินแล้ว", "customer")).toBe("ชำระเงินแล้ว");
    expect(proofTerms(null, "customer")).toBeNull();
    // Called twice in a row: a global pattern must not carry its position between calls.
    expect(proofTerms(`ไม่พบ${OLD}นี้`, "staff")).toBe("ไม่พบ Proof นี้");
  });

  it("knows the audience from the API surface", () => {
    expect(audienceOfPath("/bff/v1/store/proofs/1")).toBe("customer");
    expect(audienceOfPath("/v1/admin/proofs/1")).toBe("staff");
    expect(audienceOfPath("/v1/partner/jobs")).toBe("staff");
  });
});
