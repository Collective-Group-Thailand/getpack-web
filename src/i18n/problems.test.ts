import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BFF_PROBLEM_CODES } from "@/lib/bff/codes";
import type { Zone } from "@/lib/zones";

import en from "./messages/en/common/problems.json";
import th from "./messages/th/common/problems.json";
import { loadMessages } from "./messages";
import { problemCodesFor } from "./problems";

/**
 * The problem-code copy gate (U1 U-F0.1 step 4: "no unmapped codes for operations the UI calls").
 *
 * Every typed call to the contract (`.GET("/v1/…")` and friends) is found in the source, and every
 * problem code the contract documents for that operation must have a th and an en title, and must
 * survive the per-zone cut the loader makes. A new call, or a contract that documents a new code,
 * fails here with the code named — rather than a screen that falls back to generic wording.
 */

type Tree = { [key: string]: string | Tree };
type Operation = { responses?: Record<string, { content?: Record<string, { examples?: Record<string, unknown> }> }> };

const contract = JSON.parse(readFileSync(join(process.cwd(), "contract/openapi.json"), "utf8")) as {
  paths: Record<string, Record<string, Operation>>;
  components: { examples: Record<string, unknown> };
};
const contractCodes = new Set(
  Object.keys(contract.components.examples)
    .filter((key) => key.startsWith("problem."))
    .map((key) => key.slice("problem.".length)),
);

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leaves(value, `${prefix}${key}.`),
  );
}

function documentedCodes(operation: Operation): string[] {
  return Object.entries(operation.responses ?? {})
    .filter(([status]) => /^[45]\d\d$/.test(status))
    .flatMap(([, response]) =>
      Object.values(response.content ?? {}).flatMap((media) => Object.keys(media.examples ?? {})),
    );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

/** `"GET /v1/store/cart"` for every typed contract call in `src`. */
function calledOperations(): Set<string> {
  const called = new Set<string>();
  for (const file of sourceFiles(join(process.cwd(), "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.(GET|POST|PUT|PATCH|DELETE)\(\s*["'](\/v1\/[^"']+)["']/g)) {
      const [, method, path] = match;
      if (contract.paths[path!]?.[method!.toLowerCase()]) called.add(`${method} ${path}`);
    }
  }
  return called;
}

const ZONES_BY_SURFACE: Record<string, readonly Zone[]> = {
  store: ["customer"],
  admin: ["admin"],
  partner: ["partner"],
  auth: ["customer", "admin", "partner"],
};

describe("problem-code copy", () => {
  const thCodes = new Set(leaves(th as Tree));
  const enCodes = new Set(leaves(en as Tree));

  it("has a th and an en title for every code an operation the UI calls can return", () => {
    const called = calledOperations();
    expect(called.size).toBeGreaterThan(50);

    const unmapped: string[] = [];
    for (const key of called) {
      const [method, path] = key.split(" ") as [string, string];
      const surface = /^\/v1\/([a-z]+)\//.exec(path)?.[1] ?? "";
      for (const code of documentedCodes(contract.paths[path]![method.toLowerCase()]!)) {
        if (!thCodes.has(code) || !enCodes.has(code)) unmapped.push(`${code} (${key}): no copy`);
        for (const zone of ZONES_BY_SURFACE[surface] ?? []) {
          if (!problemCodesFor(zone).has(code)) unmapped.push(`${code} (${key}): not loaded for the ${zone} zone`);
        }
      }
    }
    expect([...new Set(unmapped)]).toEqual([]);
  });

  it("has copy for every code the BFF answers with", () => {
    expect(BFF_PROBLEM_CODES.filter((code) => !thCodes.has(code) || !enCodes.has(code))).toEqual([]);
  });

  it("holds no copy for a code that no longer exists", () => {
    const known = new Set<string>([...contractCodes, ...BFF_PROBLEM_CODES]);
    expect([...thCodes, ...enCodes].filter((code) => !known.has(code))).toEqual([]);
  });

  it("gives each zone only the codes its own surface can return", async () => {
    const customer = (await loadMessages("th", "customer")).problems as Tree;
    const admin = (await loadMessages("th", "admin")).problems as Tree;
    // The back office's ledger errors never travel with a storefront page.
    expect(customer.ledger).toBeUndefined();
    expect(admin.ledger).toBeDefined();
    expect((customer.auth as Tree).otp_invalid).toBe((th as Tree & { auth: Tree }).auth.otp_invalid);
  });
});
