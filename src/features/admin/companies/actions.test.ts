import { describe, expect, it } from "vitest";

import { companyActions } from "./actions";

const holding =
  (...permissions: string[]) =>
  (permission: string) =>
    permissions.includes(permission);

describe("companyActions", () => {
  it("offers the KYC decisions on a company under review to companies.kyc_review only", () => {
    expect(companyActions("kyc_review", holding("companies.kyc_review")).map((a) => a.key)).toEqual([
      "approve-kyc",
      "reject-kyc",
    ]);
    expect(companyActions("kyc_review", holding("companies.manage")).map((a) => a.key)).toEqual(["close"]);
  });

  it("suspends an active company, reactivates a suspended one, and never acts on a closed one", () => {
    const manage = holding("companies.manage");
    expect(companyActions("active", manage).map((a) => a.key)).toEqual(["suspend", "close"]);
    expect(companyActions("suspended", manage).map((a) => a.key)).toEqual(["reactivate", "close"]);
    expect(companyActions("closed", manage)).toEqual([]);
  });

  it("asks a reason for everything but approving KYC", () => {
    const all = companyActions("kyc_review", holding("companies.kyc_review", "companies.manage"));
    expect(all.filter((action) => !action.needsReason).map((action) => action.key)).toEqual(["approve-kyc"]);
  });
});
