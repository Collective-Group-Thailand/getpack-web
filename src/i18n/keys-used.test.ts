import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadAllMessages } from "./messages";

/**
 * Every message key the code asks for exists (th; the parity suite covers en).
 *
 * next-intl renders a missing key as its own path — "orders.detail.tabs.sumary" in the middle of
 * a Thai screen — and only logs about it at runtime. This reads the source instead: each
 * `useTranslations("ns")` / `getTranslations("ns")` binding, and every call on it with a literal
 * key, resolved against the loaded messages. A call with a template key (`t(\`statuses.${s}\`)`)
 * checks that its fixed prefix is a group of messages.
 *
 * Scope is approximated by position: a call resolves against the nearest preceding binding of the
 * same name, which matches how components sit one after another in a file.
 */

const ROOTS = ["src/app", "src/features"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|ts)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

function lookup(messages: Record<string, unknown>, path: string): unknown {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("message keys used in code", () => {
  it("exist, for every literal key and every template key's prefix", async () => {
    const messages = (await loadAllMessages("th")) as Record<string, unknown>;
    const missing: string[] = [];

    for (const file of ROOTS.flatMap((root) => files(join(process.cwd(), root)))) {
      const source = readFileSync(file, "utf8");
      const bindings = [
        ...source.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([^"]+)"\)/g),
      ].map((match) => ({
        name: match[1]!,
        namespace: match[2]!,
        at: match.index!,
      }));
      if (bindings.length === 0) continue;

      const names = [...new Set(bindings.map((binding) => binding.name))];
      for (const name of names) {
        const calls = new RegExp(`(?<![.\\w])${name}\\((?:"([^"]+)"|\`([^\`$]*)\\$\\{)`, "g");
        for (const call of source.matchAll(calls)) {
          const binding = bindings.filter((candidate) => candidate.name === name && candidate.at < call.index!).at(-1);
          if (!binding) continue;
          const relative = file.slice(process.cwd().length + 1);
          if (call[1] !== undefined) {
            const path = `${binding.namespace}.${call[1]}`;
            if (typeof lookup(messages, path) !== "string") missing.push(`${relative}: ${path}`);
          } else {
            const prefix = call[2]!.replace(/\.$/, "");
            const path = prefix ? `${binding.namespace}.${prefix}` : binding.namespace;
            const node = lookup(messages, path);
            if (node === null || typeof node !== "object") missing.push(`${relative}: ${path}.* (template)`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
