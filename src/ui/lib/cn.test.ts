import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("keeps a semantic font size beside a text colour", () => {
    expect(cn("text-display", "text-fg")).toBe("text-display text-fg");
  });

  it("lets a later radius, shadow or size override a semantic one", () => {
    expect(cn("rounded-control", "rounded-none")).toBe("rounded-none");
    expect(cn("rounded-card", "rounded-cta")).toBe("rounded-cta");
    expect(cn("shadow-card", "shadow-overlay")).toBe("shadow-overlay");
    expect(cn("text-display", "text-sm")).toBe("text-sm");
  });
});
