import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FACTORY_WORDING_ALLOWED } from "./customer-wording.allowlist";

/**
 * GLOBAL-RULES §1: our own production is never "โรงงาน" / "factory" on a customer-facing surface.
 * Every customer message file, both locales, is scanned; only the allow-listed keys (the
 * /partner-with-us namespace, which talks to factories) may use the words.
 */
const ROOT = path.join(process.cwd(), "src/i18n/messages");
const FORBIDDEN = /โรงงาน|factory|factories/i;

function* strings(value: unknown, prefix = ""): Generator<[string, string]> {
  if (typeof value === "string") yield [prefix, value];
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) yield* strings(child, prefix ? `${prefix}.${key}` : key);
  }
}

describe("customer-facing messages", () => {
  for (const locale of ["th", "en"]) {
    const dir = path.join(ROOT, locale, "customer");
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
      it(`${locale}/customer/${file} has no factory wording outside the allow-list`, () => {
        const allowed = FACTORY_WORDING_ALLOWED[file]?.prefixes ?? [];
        const messages: unknown = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        const hits = [...strings(messages)]
          .filter(([key, text]) => FORBIDDEN.test(text) && !allowed.some((prefix) => key.startsWith(prefix)))
          .map(([key, text]) => `${key}: ${text}`);
        expect(hits).toEqual([]);
      });
    }
  }

  it("keeps every allow-list entry justified and in use", () => {
    for (const [file, entry] of Object.entries(FACTORY_WORDING_ALLOWED)) {
      expect(entry.reason.length, file).toBeGreaterThan(20);
      const messages: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, "th/customer", file), "utf8"));
      const used = [...strings(messages)].some(
        ([key, text]) => FORBIDDEN.test(text) && entry.prefixes.some((prefix) => key.startsWith(prefix)),
      );
      expect(used, `${file} allow-list is unused`).toBe(true);
    }
  });
});
