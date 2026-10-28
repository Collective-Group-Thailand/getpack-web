import { describe, expect, it } from "vitest";

import { hubRedirectOf } from "./hub-redirect";

describe("/studio/new → /studio (C7, studio Phase 0)", () => {
  it("sends the old hub to the one hub, keeping its parameters but the step", () => {
    expect(hubRedirectOf({})).toBe("/studio");
    expect(hubRedirectOf({ start: "product", step: "start" })).toBe("/studio?start=product");
    expect(hubRedirectOf({ start: "product", utm_source: "line" })).toBe("/studio?start=product&utm_source=line");
  });

  it("keeps every editor entry in the editor", () => {
    expect(hubRedirectOf({ style: "rsc", l: "100", w: "80", h: "60" })).toBeNull();
    expect(hubRedirectOf({ template: "0192f3a0-7c1e-7d2a-9b1f-0000000e5005" })).toBeNull();
    expect(hubRedirectOf({ order: "a", item: "b" })).toBeNull();
    expect(hubRedirectOf({ product: "rsc-carton", pattern: "p", step: "start" })).toBeNull();
    expect(hubRedirectOf({ product: "tuck-end-box", step: "start" })).toBeNull();
    expect(hubRedirectOf({ step: "box" })).toBeNull();
  });
});
