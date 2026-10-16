import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/ui/icons";
import { loadAllMessages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import { STATUS_MAPS, UNKNOWN_STATUS } from "./index";
import { API_ACTION_KEYS, nextActionMeta, primaryAction, UNKNOWN_ACTION } from "./next-action";

type Messages = Record<string, unknown>;

/** Reads `order.waitingPayment` out of the loaded `status` namespace, or `undefined`. */
function read(messages: Messages, path: string): unknown {
  let current: unknown = messages;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Messages)[part];
  }
  return current;
}

const ALL_META = Object.values(STATUS_MAPS).flatMap((map) => Object.values(map));

describe("the status maps", () => {
  it("has a map for every vocabulary in ./contract.ts, and nothing else", async () => {
    // If a vocabulary is added to `./contract.ts` without a map — or a map outlives its
    // vocabulary — this is what says so. Read from the source so the list cannot drift.
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(`${process.cwd()}/src/domain/status/contract.ts`, "utf8");
    const vocabularies = [...source.matchAll(/^export type (\w+) =/gm)].map((match) => match[1]);
    expect(Object.keys(STATUS_MAPS)).toHaveLength(vocabularies.length);
  });

  it("never relies on colour alone — every status carries an icon and words", () => {
    // design-system.md §2. A tone is invisible in the high-contrast theme, in greyscale and
    // to a screen reader; the icon and the label are what actually carry the meaning.
    for (const meta of ALL_META) {
      expect(meta.tone).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.labelKey).toBeTruthy();
    }
  });

  it("only names icons the registry actually ships", () => {
    // `IconName` makes this a type error too, but the runtime check catches a map built from
    // data later on, and names the offender instead of pointing at a line.
    for (const meta of ALL_META) {
      expect(ICON_NAMES, `unregistered icon "${meta.icon}"`).toContain(meta.icon);
    }
  });

  it("resolves every label key in both Thai and English", async () => {
    // The parity suite in src/i18n/messages.test.ts proves th and en hold the same keys. This
    // proves the keys the maps *point at* are among them — a labelKey with a typo would
    // otherwise render as "order.watingPayment" in front of a customer.
    for (const locale of routing.locales) {
      const messages = await loadAllMessages(locale);
      const status = messages.status as Messages;

      for (const meta of ALL_META) {
        expect(typeof read(status, meta.labelKey), `${locale}: status.${meta.labelKey}`).toBe("string");
      }
      expect(typeof read(status, UNKNOWN_STATUS.labelKey)).toBe("string");
    }
  });

  it("gives no two statuses in one domain the same label", async () => {
    // Two rows of a queue that read identically are worse than one that reads awkwardly.
    const messages = await loadAllMessages("th");
    const status = messages.status as Messages;

    for (const [domain, map] of Object.entries(STATUS_MAPS)) {
      const labels = Object.values(map).map((meta) => read(status, meta.labelKey));
      expect(new Set(labels).size, `duplicate Thai labels in ${domain}`).toBe(labels.length);
    }
  });
});

describe("next actions", () => {
  it("presents a known verb, whatever domain prefixes it", () => {
    expect(nextActionMeta("approve").labelKey).toBe("action.approve");
    expect(nextActionMeta("order.approve").labelKey).toBe("action.approve");
    // `approve_slip` is not in the table; the verb before the underscore is.
    expect(nextActionMeta("order.approve_slip").labelKey).toBe("action.approve");
  });

  it("presents every action getpack-api offers", () => {
    // `NextActionDto.key` is a string in the contract, so the build cannot hold this table to it.
    expect(API_ACTION_KEYS.filter((key) => nextActionMeta(key) === UNKNOWN_ACTION)).toEqual([]);
  });

  it("still renders an action the UI has never met", () => {
    // The API decides what is offered (ADR-0005). Dropping an unknown action would hide a
    // capability the backend just shipped, which is the failure mode worth avoiding.
    expect(nextActionMeta("order.frobnicate")).toBe(UNKNOWN_ACTION);
  });

  it("resolves every action label in both locales", async () => {
    for (const locale of routing.locales) {
      const messages = await loadAllMessages(locale);
      const status = messages.status as Messages;
      for (const key of ["approve", "reject", "cancel", "submit", "pay", "upload", "unknown"]) {
        expect(typeof read(status, `action.${key}`), `${locale}: status.action.${key}`).toBe("string");
      }
    }
  });

  it("leads with the first action the API has not blocked", () => {
    const actions = [{ key: "order.pay", disabledReason: "instalment.not_due" }, { key: "order.cancel" }];
    // The API's order is the workflow's order; this picks from it rather than re-ranking.
    expect(primaryAction(actions)?.key).toBe("order.cancel");
    expect(primaryAction([])).toBeUndefined();
    expect(primaryAction(undefined)).toBeUndefined();
  });
});
