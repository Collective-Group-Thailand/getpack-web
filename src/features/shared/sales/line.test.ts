import { describe, expect, it } from "vitest";

import { lineShareUrl } from "./line";

describe("LINE share URL (D-467 share fallbacks)", () => {
  it("encodes the whole message, link included", () => {
    expect(lineShareUrl("สั่งกล่องกับ getpack https://getpack.co/a/MOCKAG01")).toBe(
      "https://line.me/R/share?text=%E0%B8%AA%E0%B8%B1%E0%B9%88%E0%B8%87%E0%B8%81%E0%B8%A5%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%81%E0%B8%B1%E0%B8%9A%20getpack%20https%3A%2F%2Fgetpack.co%2Fa%2FMOCKAG01",
    );
  });
});
