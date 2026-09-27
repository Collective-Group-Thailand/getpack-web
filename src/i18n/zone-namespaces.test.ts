import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ZONE_NAMESPACES } from "./messages";

/**
 * Every namespace a zone's own code reads is loaded for that zone.
 *
 * `keys-used.test.ts` proves a key exists in the messages; it cannot see that a namespace is
 * missing from `ZONE_NAMESPACES`, which renders every string of a screen as its raw key — found
 * in F5 5.2, where two new partner namespaces were registered but not loaded for the zone.
 */

const ROOTS: Record<keyof typeof ZONE_NAMESPACES, string[]> = {
  partner: ["src/features/partner", "src/app/partner"],
  admin: ["src/features/admin", "src/app/admin"],
  customer: ["src/features/customer", "src/app/[locale]"],
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("zone namespaces", () => {
  it.each(Object.keys(ROOTS) as (keyof typeof ROOTS)[])("the %s zone loads every namespace its code reads", (zone) => {
    const loaded = new Set<string>(ZONE_NAMESPACES[zone]);
    const missing = new Set<string>();
    for (const file of ROOTS[zone].flatMap(files)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /(?:useTranslations|getTranslations)\(\s*["']([A-Za-z]+)(?:[.][^"']*)?["']/g,
      )) {
        if (!loaded.has(match[1]!)) missing.add(`${match[1]} (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
