import { parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

import { loadAllMessages } from "./messages";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

function flatten(value: Messages, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === "object" ? flatten(child as Messages, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

/**
 * design-system.md §8 wants every string in `src/i18n` in both languages. A key that exists
 * only in Thai renders as its own path in English, which is the kind of thing nobody notices
 * until a customer does.
 */
describe("messages", () => {
  it("has the same keys in every locale", async () => {
    const [th, en] = await Promise.all(routing.locales.map((locale) => loadAllMessages(locale)));
    const thKeys = flatten(th).sort();
    const enKeys = flatten(en).sort();

    expect(thKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !thKeys.includes(key))).toEqual([]);
  });

  it("has no empty strings", async () => {
    for (const locale of routing.locales) {
      const messages = await loadAllMessages(locale);
      const empties = Object.entries(messages).flatMap(([namespace, value]) =>
        flatten(value as Messages, `${namespace}.`).filter((key) => {
          const parts = key.split(".").slice(1);
          let current: unknown = value;
          for (const part of parts) current = (current as Messages)[part];
          return typeof current === "string" && current.trim() === "";
        }),
      );
      expect(empties, `empty messages in ${locale}`).toEqual([]);
    }
  });

  it("keeps the ICU placeholders identical across locales", async () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
    const [th, en] = await Promise.all(routing.locales.map((locale) => loadAllMessages(locale)));

    const read = (messages: Record<string, unknown>, key: string): string => {
      let current: unknown = messages;
      for (const part of key.split(".")) current = (current as Messages)[part];
      return current as string;
    };

    for (const key of flatten(th)) {
      const thText = read(th, key);
      const enText = read(en, key);
      if (typeof thText !== "string" || typeof enText !== "string") continue;
      expect(placeholders(enText), `placeholders differ for ${key}`).toEqual(placeholders(thText));
    }
  });

  it("parses as ICU in every locale", async () => {
    // Plurals arrived with the resend timer and F2–F6 will add many more. A malformed one
    // ("{n, plural, one {#}}" with no `other`) is accepted by the JSON parser, survives lint
    // and typecheck, and only fails when a real user hits that branch — which for a plural is
    // exactly the uncommon case nobody clicks through in review.
    for (const locale of routing.locales) {
      const messages = await loadAllMessages(locale);
      for (const [namespace, value] of Object.entries(messages)) {
        for (const key of flatten(value as Messages)) {
          const text = key.split(".").reduce<unknown>((current, part) => (current as Messages)[part], value);
          if (typeof text !== "string") continue;
          expect(() => parse(text), `${locale}: ${namespace}.${key} is not valid ICU`).not.toThrow();
        }
      }
    }
  });

  it("gives every plural an `other` branch", async () => {
    // `other` is the only branch ICU requires and the only one Thai uses, so a message that
    // omits it is broken in the default locale.
    for (const locale of routing.locales) {
      const messages = await loadAllMessages(locale);
      for (const [namespace, value] of Object.entries(messages)) {
        for (const key of flatten(value as Messages)) {
          const text = key.split(".").reduce<unknown>((current, part) => (current as Messages)[part], value);
          if (typeof text !== "string" || !text.includes("plural")) continue;
          expect(text, `${locale}: ${namespace}.${key}`).toMatch(/other\s*\{/);
        }
      }
    }
  });
});
