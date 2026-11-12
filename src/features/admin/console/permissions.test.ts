import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STAFF_PERMISSIONS, STAFF_ROLE_GRANTS } from "../../../../mocks/generated/rbac";
import { MENU_CATALOGUE, PERSONAS } from "../../../../mocks/personas";

/**
 * Backend names win (triage `admin.permissions`, U-F0.3): every permission the admin zone or its
 * mock checks is one getpack-api grants to staff, and every persona holds exactly its role's grants.
 */

const ROOT = process.cwd();
const known = new Set<string>(STAFF_PERMISSIONS);

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Where a permission is named: `useCan(…)`, `permission="…"` / `permission: "…"`, `can(who, "…")`, `access(request, "…")`, `registerQueue("…")`. */
function checkedPermissions(source: string): string[] {
  const found: string[] = [];
  const key = String.raw`"([a-z_]+(?:\.[a-z_]+)+)"`;
  for (const match of source.matchAll(/useCan\(([^)]*)\)/g)) {
    for (const literal of match[1]!.matchAll(new RegExp(key, "g"))) found.push(literal[1]!);
  }
  const single = [
    String.raw`permission[=:]\s*${key}`,
    String.raw`\bcan\([^,()]+,\s*${key}`,
    String.raw`\baccess\([^()]*?,\s*${key}`,
    String.raw`registerQueue\(${key}`,
  ];
  for (const pattern of single) for (const match of source.matchAll(new RegExp(pattern, "g"))) found.push(match[1]!);
  return found;
}

describe("admin permissions", () => {
  it("names only permissions getpack-api grants to staff", () => {
    const unknown = ["src/features/admin", "src/app/admin", "mocks/admin"].flatMap((dir) =>
      files(dir).flatMap((file) =>
        checkedPermissions(readFileSync(join(ROOT, file), "utf8"))
          .filter((permission) => !known.has(permission))
          .map((permission) => `${file}: ${permission}`),
      ),
    );
    expect(unknown).toEqual([]);
  });

  it("finds the checks it guards", () => {
    // A regex that stops matching would pass the test above vacuously.
    const inUi = files("src/features/admin").flatMap((file) =>
      checkedPermissions(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(inUi).toContain("rfqs.manage");
    expect(inUi).toContain("promotions.manage");
  });

  it("gives every persona exactly its role's grants", () => {
    for (const persona of PERSONAS) {
      const expected = [...new Set(persona.roles.flatMap((role) => STAFF_ROLE_GRANTS[role] ?? []))].sort();
      expect([...persona.permissions].sort(), persona.key).toEqual(expected);
      expect(
        persona.roles.every((role) => role in STAFF_ROLE_GRANTS),
        persona.key,
      ).toBe(true);
    }
  });

  it("keys every menu entry on a staff permission", () => {
    const named = MENU_CATALOGUE.flatMap(({ permission }) =>
      permission === null ? [] : typeof permission === "string" ? [permission] : [...permission],
    );
    expect(named.filter((permission) => !known.has(permission))).toEqual([]);
  });
});
