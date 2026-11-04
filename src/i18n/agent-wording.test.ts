import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The agent portal's wording gate (AGENT-PORTAL-AUTORUN §6, P7) on every message an agent or a prospective agent
 * reads: the programme pages (`customer/agent.json`) and getpack Agent (`agent/*.json`), both locales. None of them
 * may talk about profit or margin (an agent never sees what getpack makes), name or count production partners,
 * offer something for "฿0" (free is "ฟรี"), promise "coming soon", or say an image was made by AI. Code comments
 * that state these rules are not copy and are not scanned.
 */
const ROOT = path.join(process.cwd(), "src/i18n/messages");
const RULES: [string, RegExp][] = [
  ["profit or margin", /กำไร|margin|profit/i],
  ["production partners", /โรงงาน|factory|factories/i],
  ["฿0 for free", /฿\s?0(?![0-9.,])/],
  ["coming soon", /กำลังพัฒนา|เร็ว ?ๆ ?นี้|coming soon/i],
  ["AI-image wording", /ภาพ(จาก|สร้างด้วย|โดย) ?AI|AI[- ]generated|generated (by|with) AI|AI image/i],
];

function* strings(value: unknown, prefix = ""): Generator<[string, string]> {
  if (typeof value === "string") yield [prefix, value];
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) yield* strings(child, prefix ? `${prefix}.${key}` : key);
  }
}

const FILES = ["th", "en"].flatMap((locale) => [
  path.join(locale, "customer", "agent.json"),
  ...fs
    .readdirSync(path.join(ROOT, locale, "agent"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(locale, "agent", name)),
]);

describe("agent-facing wording", () => {
  it.each(FILES)("%s says nothing the agent portal rules forbid", (file) => {
    const messages: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
    const hits = [...strings(messages)].flatMap(([key, text]) =>
      RULES.filter(([, pattern]) => pattern.test(text)).map(([rule]) => `${key} (${rule}): ${text}`),
    );
    expect(hits).toEqual([]);
  });
});
