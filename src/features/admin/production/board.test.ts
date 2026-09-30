import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { boardColumns, currentMilestone } from "./board";

type Job = Schemas["AdminJobDto"];
type Step = Job["milestones"][number];

const step = (seq: number, status: Step["status"]): Step =>
  ({ id: `m${seq}`, seq, key: `step_${seq}`, nameTh: `ขั้น ${seq}`, nameEn: `Step ${seq}`, status }) as Step;
const job = (id: string, status: Job["status"], milestones: Step[], atRisk = false): Job =>
  ({ id, status, milestones, atRisk }) as Job;

describe("the production board's columns", () => {
  it("puts a job in its first open milestone, or the last when all are done", () => {
    expect(currentMilestone(job("a", "in_progress", [step(2, "pending"), step(1, "completed")]))?.key).toBe("step_2");
    expect(currentMilestone(job("b", "in_progress", [step(1, "completed"), step(2, "skipped")]))?.key).toBe("step_2");
    expect(currentMilestone(job("c", "released", []))).toBeNull();
  });

  it("orders the columns by the route, counts the at-risk jobs, and leaves finished jobs off", () => {
    const columns = boardColumns([
      job("a", "in_progress", [step(1, "completed"), step(2, "in_progress")], true),
      job("b", "released", []),
      job("c", "accepted", [step(1, "pending"), step(2, "pending")]),
      job("d", "in_progress", [step(1, "completed"), step(2, "pending")]),
      job("e", "completed", [step(1, "completed"), step(2, "completed")]),
    ]);
    expect(columns.map((column) => [column.key, column.jobs.map((item) => item.id), column.atRisk])).toEqual([
      [null, ["b"], 0],
      ["step_1", ["c"], 0],
      ["step_2", ["a", "d"], 1],
    ]);
  });
});
