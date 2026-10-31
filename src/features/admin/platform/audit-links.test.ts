import { describe, expect, it } from "vitest";

import { auditLines, auditRecordHref } from "./audit-links";

describe("audit entries", () => {
  it("links a record with a console page, and nothing else", () => {
    expect(auditRecordHref("user", "u1")).toBe("/users/u1");
    expect(auditRecordHref("webhook_subscription", "w1")).toBeNull();
    expect(auditRecordHref(null, null)).toBeNull();
  });

  it("reads a before/after pair as changes and keeps every other field", () => {
    expect(auditLines({ before: "active", after: "inactive", reason: "left" })).toEqual([
      { key: "", before: "active", after: "inactive" },
      { key: "reason", value: "left" },
    ]);
    expect(auditLines({ before: { a: 1, b: 2 }, after: { a: 1, b: 3 } })).toEqual([{ key: "b", before: 2, after: 3 }]);
    expect(auditLines({ method: "password" })).toEqual([{ key: "method", value: "password" }]);
  });
});
