// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fingerprintFor } = await import("./fingerprint.server");

describe("hand-off fingerprint (D-467)", () => {
  it("is the same on both hosts for the same browser, and within the contract's 16–512 characters", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    expect(fingerprintFor(ua)).toBe(fingerprintFor(ua));
    expect(fingerprintFor(ua)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs between browsers, and never carries the user agent itself", () => {
    expect(fingerprintFor("A")).not.toBe(fingerprintFor("B"));
    expect(fingerprintFor("Mozilla")).not.toContain("Mozilla");
    expect(fingerprintFor(null)).toHaveLength(64);
  });
});
