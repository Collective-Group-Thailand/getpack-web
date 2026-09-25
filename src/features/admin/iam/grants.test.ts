import { describe, expect, it } from "vitest";

import { grantableRoles, missingPermissions, sodConflicts, type Role, type SodRule, type User } from "./grants";

const role = (key: string, audience: Role["audience"], permissions: string[] = [], scopeType: Role["scopeType"] = "platform"): Role => ({
  key,
  audience,
  scopeType,
  nameTh: key,
  nameEn: key,
  permissions,
});

const user = (kind: User["kind"], roles: string[]): User => ({
  id: "u1",
  displayName: "u",
  email: null,
  phone: null,
  kind,
  status: "active",
  lastLoginAt: null,
  createdAt: "2026-09-22T09:00:00+07:00",
  roles: roles.map((r, i) => ({ id: `g${i}`, role: r, scopeType: "platform", scopeId: null, reason: "x", validFrom: "2026-09-22T09:00:00+07:00", validTo: null })),
});

const AUDITOR_RULES: SodRule[] = [
  { id: "1", kind: "role_pair", left: "auditor", right: "finance", enforcement: "block", description: "D-168", decisions: ["D-168"] },
  { id: "2", kind: "action_pair", left: "refund.request", right: "refund.approve", enforcement: "block", description: "§8", decisions: [] },
];

describe("role grants", () => {
  it("offers only roles for the account's audience that it does not already hold", () => {
    const roles = [role("cs", "staff"), role("finance", "staff"), role("factory_owner", "partner", [], "factory")];
    expect(grantableRoles(roles, user("staff", ["cs"])).map((r) => r.key)).toEqual(["finance"]);
    expect(grantableRoles(roles, user("partner", [])).map((r) => r.key)).toEqual(["factory_owner"]);
  });

  it("finds the SoD role pair a grant would break, in either direction (D-168)", () => {
    expect(sodConflicts(AUDITOR_RULES, user("staff", ["finance"]), "auditor")).toHaveLength(1);
    expect(sodConflicts(AUDITOR_RULES, user("staff", ["auditor"]), "finance")).toHaveLength(1);
    expect(sodConflicts(AUDITOR_RULES, user("staff", ["cs"]), "auditor")).toEqual([]);
  });

  it("ignores action pairs, which only the API can check against the audit trail", () => {
    expect(sodConflicts(AUDITOR_RULES, user("staff", ["refund.request"]), "refund.approve")).toEqual([]);
  });

  it("names the permissions a grantor lacks for a staff role, and exempts partner roles", () => {
    expect(missingPermissions(role("finance", "staff", ["a", "b", "c"]), ["a"])).toEqual(["b", "c"]);
    expect(missingPermissions(role("factory_owner", "partner", ["x"]), [])).toEqual([]);
  });
});
