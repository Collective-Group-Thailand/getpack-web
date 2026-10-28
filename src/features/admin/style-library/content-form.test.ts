import { describe, expect, it } from "vitest";

import {
  cleanContent,
  contentErrors,
  isExpired,
  newCertification,
  newLogo,
  newPhoto,
  type LibraryContent,
} from "./content-form";

const empty = (): LibraryContent => ({
  quickSearch: [{ label: { th: "เมลเลอร์", en: null }, query: "เมลเลอร์" }],
  materialSwatches: [],
  trust: { certifications: [], foodGrade: [], productionPhotos: [], customerLogos: [], taxInvoiceNote: null },
});

describe("style library content editor (C1c, DECISIONS-STAGE-A §11.5)", () => {
  it("accepts empty content and keeps the parts it does not edit", () => {
    expect(contentErrors(empty())).toEqual([]);
    expect(cleanContent(empty()).quickSearch).toEqual(empty().quickSearch);
  });

  it("needs names, https or site links, dates and a logo's recorded permission", () => {
    const c = empty();
    c.trust.certifications.push({ ...newCertification(), expiresOn: "31/12/2026", documentUrl: "http://x" });
    c.trust.productionPhotos.push(newPhoto());
    c.trust.customerLogos.push({ ...newLogo(), name: "ร้าน", logoUrl: "/logos/a.svg" });
    expect(contentErrors(c)).toEqual([
      { path: "trust.certifications.0.title", code: "required" },
      { path: "trust.certifications.0.expiresOn", code: "date" },
      { path: "trust.certifications.0.documentUrl", code: "url" },
      { path: "trust.productionPhotos.0.url", code: "required" },
      { path: "trust.productionPhotos.0.alt", code: "required" },
      { path: "trust.customerLogos.0.permission", code: "required" },
    ]);
  });

  it("trims, turns empty optional text into null and drops an empty tax note", () => {
    const c = empty();
    c.trust.certifications.push({
      title: { th: " FSC ", en: " " },
      number: " FSC-C1 ",
      issuer: "",
      expiresOn: "",
      documentUrl: " https://example.invalid/fsc.pdf ",
    });
    c.trust.taxInvoiceNote = { th: " ", en: null };
    const out = cleanContent(c);
    expect(out.trust.certifications[0]).toEqual({
      title: { th: "FSC", en: null },
      number: "FSC-C1",
      issuer: null,
      expiresOn: null,
      documentUrl: "https://example.invalid/fsc.pdf",
    });
    expect(out.trust.taxInvoiceNote).toBeNull();
  });

  it("marks expired certificates (the storefront leaves them out)", () => {
    expect(isExpired({ expiresOn: "2026-10-27" }, "2026-10-28")).toBe(true);
    expect(isExpired({ expiresOn: "2026-10-28" }, "2026-10-28")).toBe(false);
    expect(isExpired({ expiresOn: null }, "2026-10-28")).toBe(false);
  });
});
