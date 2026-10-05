/**
 * What the UI can tell about a role grant before the click. The API decides (B1.3 refuses with
 * `iam.sod_conflict`, `iam.role_escalation`, `iam.self_grant`, `iam.role_scope_mismatch`); these
 * only stop someone composing a grant that is certain to be refused, and say why.
 */

import type { Schemas } from "@/lib/api/types";

export type Role = Schemas["RoleDto"];
export type User = Schemas["UserAdminDto"];
export type SodRule = Schemas["SodRuleDto"];

/** Roles whose audience matches the account — a customer role on a staff account is meaningless. */
export function grantableRoles(roles: readonly Role[], user: User): Role[] {
  const held = new Set(user.roles.map((grant) => `${grant.role}:${grant.scopeId ?? ""}`));
  return roles.filter(
    (role) => role.audience === user.kind && (role.scopeType !== "platform" || !held.has(`${role.key}:`)),
  );
}

/** The SoD role-pair rules a new grant of `role` would break, given what the user already holds. */
export function sodConflicts(rules: readonly SodRule[], user: User, role: string): SodRule[] {
  const held = new Set(user.roles.map((grant) => grant.role));
  return rules.filter(
    (rule) =>
      rule.kind === "role_pair" &&
      ((rule.left === role && held.has(rule.right)) || (rule.right === role && held.has(rule.left))),
  );
}

/**
 * Permissions of a staff role the grantor does not hold. B1.3: "staff roles can be granted only
 * by someone who holds all of the role's permissions". Partner and company roles are exempt.
 */
export function missingPermissions(role: Role, grantorPermissions: readonly string[]): string[] {
  if (role.audience !== "staff") return [];
  const own = new Set(grantorPermissions);
  return role.permissions.filter((permission) => !own.has(permission));
}

/** D-141: permissions that expose factory buy prices or margins, marked wherever roles are shown. */
export const SENSITIVE_PERMISSIONS = new Set([
  "factory_buy_prices.read",
  "margin.read",
  "margin.read_pct_when_discounting",
  "settings.read_sensitive",
]);
