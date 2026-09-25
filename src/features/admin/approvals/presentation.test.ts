import { describe, expect, it } from "vitest";

import { decisionBlocker, type Approval } from "./presentation";

const base: Approval = {
  id: "r1",
  policy: "discount_memo",
  subjectType: "discount_memo",
  subjectId: "s1",
  status: "pending",
  requester: { id: "cs-1", displayName: "CS" },
  amount: null,
  currency: "THB",
  pct: null,
  flags: [],
  payload: {},
  currentStepNo: 1,
  steps: [],
  actions: [],
  createdAt: "2026-09-25T10:00:00+07:00",
  expiresAt: null,
  decidedAt: null,
};

describe("decisionBlocker", () => {
  it("says a requester cannot approve their own request (maker-checker)", () => {
    expect(decisionBlocker(base, "cs-1")).toBe("own_request");
  });

  it("says someone who approved one step cannot approve another", () => {
    const acted = { ...base, actions: [{ action: "approve", actor: { id: "d-1", displayName: "D" }, at: base.createdAt, comment: null, stepNo: 1, onBehalfOf: null }] } as Approval;
    expect(decisionBlocker(acted, "d-1")).toBe("already_acted");
  });

  it("has nothing to say about a pending request from someone else", () => {
    expect(decisionBlocker(base, "d-1")).toBeNull();
    expect(decisionBlocker({ ...base, status: "approved" }, "d-1")).toBe("not_pending");
  });
});
