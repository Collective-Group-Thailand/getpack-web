import { describe, expect, it } from "vitest";

import { canOfferSelfApproval, conditionUsesAmount, decisionBlocker, moneyInput, type Approval } from "./presentation";

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
  selfApproved: false,
  autoApprovedReason: null,
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
    const acted = {
      ...base,
      actions: [
        {
          action: "approve",
          actor: { id: "d-1", displayName: "D" },
          at: base.createdAt,
          comment: null,
          stepNo: 1,
          onBehalfOf: null,
          selfApproved: false,
          selfApprovalReason: null,
        },
      ],
    } as Approval;
    expect(decisionBlocker(acted, "d-1")).toBe("already_acted");
  });

  it("has nothing to say about a pending request from someone else", () => {
    expect(decisionBlocker(base, "d-1")).toBeNull();
    expect(decisionBlocker({ ...base, status: "approved" }, "d-1")).toBe("not_pending");
  });
});

describe("Superadmin powers (D-449)", () => {
  const superadmin = { id: "cs-1", roles: ["superadmin"] };

  it("offers self-approval only to a Superadmin's own pending request while solo-owner mode is on", () => {
    expect(canOfferSelfApproval(base, superadmin, { active: true })).toBe(true);
    expect(canOfferSelfApproval(base, superadmin, { active: false })).toBe(false);
    expect(canOfferSelfApproval(base, superadmin, undefined)).toBe(false);
    expect(canOfferSelfApproval(base, { id: "cs-1", roles: ["cs"] }, { active: true })).toBe(false);
    expect(canOfferSelfApproval(base, { id: "x-9", roles: ["superadmin"] }, { active: true })).toBe(false);
    expect(canOfferSelfApproval({ ...base, status: "approved" }, superadmin, { active: true })).toBe(false);
  });

  it("normalises a typed amount to two decimals without arithmetic", () => {
    expect(moneyInput("500000")).toBe("500000.00");
    expect(moneyInput("500,000.5")).toBe("500000.50");
    expect(moneyInput(" 1.25 ")).toBe("1.25");
    expect(moneyInput("1.255")).toBeNull();
    expect(moneyInput("-1")).toBeNull();
    expect(moneyInput("abc")).toBeNull();
  });

  it("finds an amount condition anywhere in a step condition", () => {
    expect(conditionUsesAmount({ field: "amount", op: "lte", value: "100000.00" })).toBe(true);
    expect(conditionUsesAmount({ all: [{ field: "pct", op: "gt", value: "5" }] })).toBe(false);
    expect(conditionUsesAmount({ any: [{ field: "flags" }, { field: "amount", op: "gt", ref: "x" }] })).toBe(true);
    expect(conditionUsesAmount(null)).toBe(false);
  });
});
