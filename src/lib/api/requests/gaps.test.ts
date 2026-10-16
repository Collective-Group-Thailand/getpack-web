import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `CONTRACT-GAP <id>` marks a place where a screen shows less than it did, because the published
 * contract carries less than the request asked for (U1 U-F0.2: "follow the contract and record
 * the change"). Each marker names the `docs/contract-requests.md` row that asks for what is
 * missing, so the day getpack-api ships it, a search for the id finds every screen to restore.
 *
 * This gate holds the markers to that: an id with no open row is a gap nobody was asked to fill.
 */

const requestsDoc = readFileSync(join(process.cwd(), "docs/contract-requests.md"), "utf8");
const openIds = new Set(
  [...requestsDoc.split("\n## Resolved")[0]!.matchAll(/^\| ([a-z][\w.-]+) \| \d{4}-\d{2}-\d{2} \|/gm)].map(
    ([, id]) => id!,
  ),
);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|json)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

function markers(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const root of ["src", "mocks", "e2e"]) {
    for (const path of files(join(process.cwd(), root))) {
      if (path.endsWith("gaps.test.ts")) continue;
      for (const [, id] of readFileSync(path, "utf8").matchAll(/CONTRACT-GAP ([a-z][\w.-]*[a-z0-9])/g)) {
        found.set(id!, [...(found.get(id!) ?? []), path.slice(process.cwd().length + 1)]);
      }
    }
  }
  return found;
}

describe("CONTRACT-GAP markers", () => {
  it("name an open row in docs/contract-requests.md", () => {
    const orphans = [...markers()]
      .filter(([id]) => !openIds.has(id))
      .map(([id, where]) => `${id} (${[...new Set(where)].join(", ")})`);
    expect(orphans).toEqual([]);
  });
});
