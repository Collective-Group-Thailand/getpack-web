import { describe, expect, it } from "vitest";

import enPages from "./messages/en/customer/pages.json";
import enStorefront from "./messages/en/customer/storefront.json";
import thPages from "./messages/th/customer/pages.json";
import thStorefront from "./messages/th/customer/storefront.json";

/** DECISIONS-STAGE-A §3 (ผ่อนชำระ hidden until live) and §1 (no deletion promise until retention ships). */
describe("copy truthfulness", () => {
  it("offers no card instalment as a payment method on the pages, footer or terms", () => {
    expect(JSON.stringify(thPages)).not.toContain("ผ่อน");
    expect(JSON.stringify(thStorefront)).not.toContain("ผ่อน");
    expect(JSON.stringify(enPages)).not.toMatch(/instal+ments?\b/i);
    expect(JSON.stringify(enStorefront)).not.toMatch(/instal+ments?\b/i);
  });

  it("promises no file deletion on /network", () => {
    expect(JSON.stringify(thStorefront)).not.toMatch(/ลบ/);
    expect(JSON.stringify(enStorefront)).not.toMatch(/delet/i);
  });
});
