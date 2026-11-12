import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FACTORY_PERMISSIONS, FACTORY_ROLE_GRANTS } from "../../../mocks/generated/rbac";
import { PARTNER_PERSONAS, ROLE_PERMISSIONS } from "../../../mocks/partner/personas";
import { SURFACE_PROBLEM_CODES } from "@/lib/api/problem-codes";

/**
 * Backend names win (triage `partner.permissions`, U-F0.4): every factory permission the partner
 * zone or its mock names is one getpack-api grants at factory scope, and every role holds exactly
 * getpack-api's grants.
 */

const ROOT = process.cwd();
const known = new Set<string>(FACTORY_PERMISSIONS);
const problems = new Set<string>(Object.values(SURFACE_PROBLEM_CODES).flat());

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every `"factory_<area>.<action>"` literal — permissions and problem codes share the spelling. */
function factoryKeys(source: string): string[] {
  return [...source.matchAll(/"(factory_[a-z_]+\.[a-z_]+)"/g)]
    .map((match) => match[1]!)
    .filter((key) => !problems.has(key));
}

describe("partner permissions", () => {
  it("names only permissions getpack-api grants at factory scope", () => {
    const unknown = ["src/features/partner", "src/app/partner", "mocks/partner"].flatMap((dir) =>
      files(dir).flatMap((file) =>
        factoryKeys(readFileSync(join(ROOT, file), "utf8"))
          .filter((permission) => !known.has(permission))
          .map((permission) => `${file}: ${permission}`),
      ),
    );
    expect(unknown).toEqual([]);
  });

  it("finds the checks it guards", () => {
    // A regex that stops matching would pass the test above vacuously.
    const inUi = files("src/features/partner").flatMap((file) => factoryKeys(readFileSync(join(ROOT, file), "utf8")));
    expect(inUi).toContain("factory_jobs.read");
    expect(inUi).toContain("factory_payables.read");
  });

  it("gives every role exactly getpack-api's grants, and every persona a known role", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(Object.keys(FACTORY_ROLE_GRANTS).sort());
    for (const [role, grants] of Object.entries(ROLE_PERMISSIONS)) {
      expect([...grants].sort(), role).toEqual([...FACTORY_ROLE_GRANTS[role]!].sort());
    }
    for (const persona of PARTNER_PERSONAS) {
      expect(
        persona.roles.every((role) => role in FACTORY_ROLE_GRANTS),
        persona.key,
      ).toBe(true);
    }
  });
});
