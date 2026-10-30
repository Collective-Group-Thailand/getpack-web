import { describe, expect, it } from "vitest";

import { maskLink } from "./HandoverPanel";

describe("maskLink", () => {
  it("keeps where the driver link leads and hides its token", () => {
    const masked = maskLink("https://getpack.localhost:3001/th/l/dAbCdEf0123456789");
    expect(masked).toBe("getpack.localhost:3001/th/l/d••••••");
    expect(masked).not.toContain("AbCdEf");
  });

  it("never echoes something that is not a URL", () => {
    expect(maskLink("dAbCdEf0123456789")).toBe("•".repeat(8));
  });
});
