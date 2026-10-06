// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Budget, budgetMax, EXCEPTIONS, type JourneyId, JOURNEYS } from "./budgets";

/**
 * The step counters and the scorecard must mean the same thing. This reads the benchmark table
 * of `docs/ux/competitive-scorecard.md` §2 and compares each task's budget with `budgets.ts`, and
 * the known exceptions of §5 with `EXCEPTIONS`. Runs under Vitest (blocking CI): a drifted budget or
 * exception is a documentation error that should stop a merge.
 */

const SCORECARD = fileURLToPath(new URL("../../docs/ux/competitive-scorecard.md", import.meta.url));

/** The table rows of one `## <n>.` section, each split into trimmed cells. */
function sectionRows(n: number): string[][] {
  const text = readFileSync(SCORECARD, "utf8");
  const start = text.indexOf(`\n## ${n}.`);
  if (start === -1) throw new Error(`The scorecard has no section ${n}`);
  const end = text.indexOf("\n## ", start + 1);
  return text
    .slice(start, end === -1 ? undefined : end)
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()));
}

function scorecardBudgets(): Map<JourneyId, { journey: string; budget: Budget }> {
  const rows = new Map<JourneyId, { journey: string; budget: Budget }>();
  for (const cells of sectionRows(2)) {
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

function scorecardExceptions(): Map<JourneyId, { ceiling: number; cause: string; owner: string }> {
  const rows = new Map<JourneyId, { ceiling: number; cause: string; owner: string }>();
  for (const cells of sectionRows(5)) {
    const id = /^(T\d{1,2})$/.exec(cells[1] ?? "")?.[1] as JourneyId | undefined;
    if (!id) continue;
    const ceiling = /^(\d+)\s+(steps|taps)$/.exec(cells[2] ?? "");
    if (!ceiling) throw new Error(`${id}: the exception's ceiling "${cells[2]}" is not "<n> steps|taps"`);
    rows.set(id, { ceiling: Number(ceiling[1]), cause: cells[3]!, owner: cells[4]! });
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

describe("known exceptions (scorecard §5)", () => {
  const listed = scorecardExceptions();

  it("are the same in the scorecard and in budgets.ts", () => {
    expect(Object.fromEntries(listed)).toEqual(EXCEPTIONS);
  });

  it.each(Object.entries(EXCEPTIONS))("%s is above a counted budget, never a way to lower one", (id, exception) => {
    const max = budgetMax(JOURNEYS[id as JourneyId].budget);
    expect(max).not.toBeNull();
    expect(exception!.ceiling).toBeGreaterThan(max!);
  });
});
