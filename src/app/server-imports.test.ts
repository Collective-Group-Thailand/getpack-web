import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A Server Component may import only **components** from a `"use client"` module.
 *
 * Anything else an RSC imports from a client module — a constant, a list, a resource definition
 * with a `fetch` — arrives as a client *reference*, not the value: `ORDER_TABS.includes` is
 * "not a function", `resource.fetch` is not callable. It compiles, passes every unit test, and
 * fails only at request time in a production build. It happened twice in F2 2.2 before this
 * test existed.
 *
 * Checked for every page and layout under `src/app`, following `@/` imports into barrels one
 * level deep (`export { X } from "./Y"`).
 */

const ROOT = process.cwd();

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return /^(page|layout)\.tsx$/.test(name) ? [path] : [];
  });
}

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const isClient = (source: string) => /^\s*["']use client["'];?/.test(source);

/** Where a name imported from `file` really comes from, following one level of re-export. */
function origin(file: string, name: string): string {
  const source = readFileSync(file, "utf8");
  if (isClient(source)) return file;
  for (const match of source.matchAll(/export\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    const names = match[1]!.split(",").map((part) =>
      part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()!,
    );
    if (names.includes(name)) {
      const target = resolveModule(file, match[2]!);
      if (target) return target;
    }
  }
  return file;
}

describe("Server Components and client modules", () => {
  it('import only components from a "use client" module', () => {
    const offenders: string[] = [];
    for (const page of pages(join(ROOT, "src/app"))) {
      const source = readFileSync(page, "utf8");
      if (isClient(source)) continue;
      for (const match of source.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+"([^"]+)"/g)) {
        const target = resolveModule(page, match[2]!);
        if (!target) continue;
        for (const raw of match[1]!.split(",")) {
          const part = raw.trim();
          if (!part || part.startsWith("type ")) continue;
          const name = part.split(/\s+as\s+/)[0]!;
          const from = origin(target, name);
          if (isClient(readFileSync(from, "utf8")) && !/^[A-Z]/.test(name)) {
            offenders.push(
              `${page.slice(ROOT.length + 1)} imports ${name} from client module ${from.slice(ROOT.length + 1)}`,
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
