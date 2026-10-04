import { describe, expect, it } from "vitest";

import { initialStep, lockedReason, STUDIO_STEPS } from "./steps";

describe("studio steps", () => {
  it("are the spec's five, in order", () => {
    expect(STUDIO_STEPS).toEqual(["start", "box", "design", "check", "order"]);
  });

  it("open ② onwards with a box, ④ and ⑤ with content", () => {
    const none = { hasBox: false, hasContent: false };
    const box = { hasBox: true, hasContent: false };
    const both = { hasBox: true, hasContent: true };
    expect(lockedReason("start", none)).toBeNull();
    expect(lockedReason("box", none)).toBe("needsBox");
    expect(lockedReason("design", box)).toBeNull();
    expect(lockedReason("check", box)).toBe("needsContent");
    expect(lockedReason("order", both)).toBeNull();
  });

  it("open on the step asked for when it is open, else the furthest open one before it", () => {
    expect(initialStep(undefined, { hasBox: false, hasContent: false })).toBe("start");
    expect(initialStep(undefined, { hasBox: true, hasContent: false })).toBe("design");
    expect(initialStep("order", { hasBox: true, hasContent: false })).toBe("design");
    expect(initialStep("order", { hasBox: true, hasContent: true })).toBe("order");
    expect(initialStep("nonsense", { hasBox: true, hasContent: true })).toBe("design");
    expect(initialStep("box", { hasBox: false, hasContent: false })).toBe("start");
  });
});
