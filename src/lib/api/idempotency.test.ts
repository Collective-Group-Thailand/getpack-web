// @vitest-environment node
import { describe, expect, it } from "vitest";

import { stableIdempotencyKey } from "./idempotency";

describe("stableIdempotencyKey", () => {
  it("is a uuid, the same for the same operation and different for another", async () => {
    const a = await stableIdempotencyKey("design:3:option");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await stableIdempotencyKey("design:3:option")).toBe(a);
    expect(await stableIdempotencyKey("design:4:option")).not.toBe(a);
  });
});
