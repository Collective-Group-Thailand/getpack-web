import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { AbstractIntlMessages } from "next-intl";
import { describe, expect, it } from "vitest";

import { clientMessages, SERVER_ONLY_MESSAGES } from "./client-messages";
import { loadMessages } from "./messages";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("client messages", () => {
  it("drops every server-only subtree and keeps its siblings", async () => {
    const messages = (await loadMessages("th", "customer")) as unknown as AbstractIntlMessages;
    const trimmed = clientMessages(messages);
    for (const path of SERVER_ONLY_MESSAGES) {
      const [namespace, key] = path.split(".") as [string, string];
      // The path is real (a typo would make the trim a silent no-op).
      expect(messages[namespace] as object, path).toHaveProperty(key);
      expect(trimmed[namespace] as object, path).not.toHaveProperty(key);
    }
    expect(Object.keys(trimmed)).toEqual(Object.keys(messages));
    expect(trimmed.styles as object).toHaveProperty("library");
    // Nothing is mutated: the server's catalogue keeps the subtree.
    expect(messages.styles as object).toHaveProperty("packagingPages");
  });

  it("no client component reads a server-only subtree", () => {
    const offenders: string[] = [];
    for (const file of files("src")) {
      const source = readFileSync(file, "utf8");
      if (!/^["']use client["']/m.test(source)) continue;
      for (const path of SERVER_ONLY_MESSAGES) {
        const [namespace, key] = path.split(".") as [string, string];
        // The full path, or the namespace's translator and the key anywhere in the same file.
        const parent = new RegExp(`useTranslations\\(\\s*["']${namespace}["']`).test(source);
        if (source.includes(path) || (parent && new RegExp(`["'\`]${key}[."'\`]`).test(source)))
          offenders.push(`${file}: ${path}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
