// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

/**
 * No raw i18n key may reach the configurator's screen. next-intl prints a message's own path
 * ("configurator.quantity.target") when the key is missing in a locale, and also when the message
 * has `{unit}`-style arguments the call did not pass (the UAT bug). Both are checked statically
 * for every `t("…")` in this folder, in Thai and English.
 */
const DIR = join(process.cwd(), "src/features/customer/configurator");

function lookup(messages: Record<string, unknown>, path: string): unknown {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("configurator i18n keys", () => {
  it.each(["th", "en"] as const)(
    "every literal t() key exists in %s and gets the arguments its message needs",
    async (locale) => {
      const messages = (await loadAllMessages(locale)) as Record<string, unknown>;
      const problems: string[] = [];
      for (const name of readdirSync(DIR).filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))) {
        const source = readFileSync(join(DIR, name), "utf8");
        const bindings = [
          ...source.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([^"]+)"\)/g),
        ].map((match) => ({ name: match[1]!, namespace: match[2]!, at: match.index! }));
        for (const binding of new Set(bindings.map((b) => b.name))) {
          const calls = new RegExp(`(?<![.\\w])${binding}\\("([^"]+)"(\\s*,)?`, "g");
          for (const call of source.matchAll(calls)) {
            const owner = bindings.filter((b) => b.name === binding && b.at < call.index!).at(-1);
            if (!owner) continue;
            const path = `${owner.namespace}.${call[1]}`;
            const message = lookup(messages, path);
            if (typeof message !== "string") problems.push(`${name}: ${path} missing in ${locale}`);
            else if (/\{\w+\s*[,}]/.test(message) && !call[2]) problems.push(`${name}: ${path} needs arguments`);
          }
        }
      }
      expect(problems).toEqual([]);
    },
  );
});
