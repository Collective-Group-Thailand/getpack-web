import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { boardColumns, columnKeyOf } from "./board";

type Job = Schemas["AdminJobDto"];
const job = (id: string, status: Job["status"], currentMilestoneKey: string | null): Job =>
  ({ id, status, currentMilestoneKey }) as Job;
const column = (key: string, total: number, atRisk = 0): Schemas["BoardColumnDto"] => ({
  key,
  labelTh: key,
  labelEn: key,
  total,
  atRisk,
});

describe("the production board's columns", () => {
  it("puts a job at the API's current milestone, and a released one awaiting acceptance", () => {
    expect(columnKeyOf(job("a", "in_progress", "step_3"))).toBe("step_3");
    expect(columnKeyOf(job("b", "released", null))).toBe("awaiting_acceptance");
    expect(columnKeyOf(job("c", "accepted", null))).toBe("awaiting_acceptance");
  });

  it("keeps the API's columns and counts, and leaves finished jobs off", () => {
    const columns = boardColumns(
      [column("awaiting_acceptance", 1), column("step_2", 2, 1)],
      [
        job("a", "in_progress", "step_2"),
        job("b", "released", null),
        job("d", "on_hold", "step_2"),
        job("e", "completed", null),
      ],
    );
    expect(columns.map((item) => [item.key, item.total, item.atRisk, item.jobs.map((entry) => entry.id)])).toEqual([
      ["awaiting_acceptance", 1, 0, ["b"]],
      ["step_2", 2, 1, ["a", "d"]],
    ]);
  });
});
