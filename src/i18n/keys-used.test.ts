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
 * A binding may also be one element of `const [t, …] = await Promise.all([getTranslations("ns"), …])`,
 * the way server pages load their copy beside their data.
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

/** The top-level elements of an array literal starting at `from` (just after its `[`). */
function elements(source: string, from: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = from;
  for (let at = from; at < source.length; at += 1) {
    const char = source[at]!;
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) {
      if (depth === 0) {
        parts.push(source.slice(start, at));
        return parts;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      parts.push(source.slice(start, at));
      start = at + 1;
    }
  }
  return parts;
}

/** `const [a, b] = await Promise.all([getTranslations("x"), …])`: each translator and its namespace. */
function destructured(source: string) {
  return [...source.matchAll(/const \[([^\]]+)\] = await Promise\.all\(\[/g)].flatMap((match) => {
    const names = match[1]!.split(",").map((name) => name.trim());
    const values = elements(source, match.index! + match[0].length);
    return names.flatMap((name, index) => {
      const namespace = /^\s*(?:useTranslations|getTranslations)\("([^"]+)"\)\s*$/.exec(values[index] ?? "")?.[1];
      return /^\w+$/.test(name) && namespace ? [{ name, namespace, at: match.index! }] : [];
    });
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
      ]
        .map((match) => ({
          name: match[1]!,
          namespace: match[2]!,
          at: match.index!,
        }))
        .concat(destructured(source))
        .sort((a, b) => a.at - b.at);
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
