import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpecLabelLine, specLabelText } from ".";

const label = {
  th: "กล่องฝาชน (RSC) · 140 × 97.5 × 60 มม. (ด้านใน) · ลูกฟูก KA125 ลอน B (3 ชั้น) · ไม่พิมพ์",
  en: "RSC · 140 × 97.5 × 60 mm (inside) · KA125 B-flute (3-ply) · Unprinted",
};

describe("specLabelText", () => {
  it("is the API's string in the reader's language, Thai as the fallback", () => {
    expect(specLabelText(label, "th")).toBe(label.th);
    expect(specLabelText(label, "en")).toBe(label.en);
    expect(specLabelText({ th: label.th, en: "" }, "en")).toBe(label.th);
  });

  it("is nothing when the API sent nothing", () => {
    expect(specLabelText(null, "th")).toBeNull();
    expect(specLabelText(undefined, "th")).toBeNull();
    expect(specLabelText({ th: "  ", en: "" }, "th")).toBeNull();
    expect(renderToStaticMarkup(<SpecLabelLine label={null} locale="th" />)).toBe("");
  });

  it("renders the label verbatim as a line under the price", () => {
    expect(renderToStaticMarkup(<SpecLabelLine label={label} locale="th" />)).toContain(label.th);
  });
});
