// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Budget, type JourneyId, JOURNEYS } from "./budgets";

/**
 * The step counters and the scorecard must mean the same thing. This reads the benchmark table
 * of `docs/ux/competitive-scorecard.md` §2 and compares each task's budget with `budgets.ts`.
 * Runs under Vitest (blocking CI), not Playwright: a drifted budget is a documentation error
 * that should stop a merge even while the counters themselves are still advisory.
 */

const SCORECARD = fileURLToPath(new URL("../../docs/ux/competitive-scorecard.md", import.meta.url));

function scorecardBudgets(): Map<JourneyId, { journey: string; budget: Budget }> {
  const rows = new Map<JourneyId, { journey: string; budget: Budget }>();
  for (const line of readFileSync(SCORECARD, "utf8").split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const id = /^(T\d{1,2})\b/.exec(cells[1] ?? "")?.[1] as JourneyId | undefined;
    if (!id || cells.length < 6) continue;
    const [, , , journey, text] = cells as [string, string, string, string, string];
    const count = /≤\s*(\d+)\s*(steps?|taps?)/.exec(text);
    const budget: Budget | null = count
      ? { unit: count[2]!.startsWith("tap") ? "taps" : "steps", max: Number(count[1]) }
      : /^0 unexplained warnings/.test(text)
        ? { unit: "unexplained-warnings", max: 0 }
        : /lever/.test(text)
          ? { unit: "lever-found" }
          : null;
    if (!budget) throw new Error(`${id}: the scorecard budget "${text}" has no reading in budgets.ts`);
    rows.set(id, { journey, budget });
  }
  return rows;
}

describe("step budgets", () => {
  const scorecard = scorecardBudgets();

  it("cover exactly the scorecard's tasks", () => {
    expect([...scorecard.keys()].sort()).toEqual(Object.keys(JOURNEYS).sort());
  });

  it.each(Object.values(JOURNEYS))("$id matches the scorecard", ({ id, journey, budget }) => {
    expect({ journey, budget }).toEqual(scorecard.get(id));
  });
});
