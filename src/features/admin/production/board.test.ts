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

describe("the six fixed stages (UX audit)", () => {
  it("places route steps by what they are and keeps every stage, empty or not", async () => {
    const { stageOf, stageColumns, STAGES } = await import("./board");
    expect(stageOf("awaiting_acceptance")).toBe("awaiting");
    expect(stageOf("job_received")).toBe("materials");
    expect(stageOf("printing")).toBe("printing");
    expect(stageOf("diecut")).toBe("post_press");
    expect(stageOf("qc_check")).toBe("qc");
    expect(stageOf("ready_to_ship")).toBe("ready");
    const columns = stageColumns([{ key: "printing", labelTh: "พิมพ์", labelEn: "Printing", total: 2, atRisk: 1 }], []);
    expect(columns.map((column) => column.stage)).toEqual([...STAGES]);
    expect(columns.find((column) => column.stage === "printing")).toMatchObject({ total: 2, atRisk: 1 });
    expect(columns.find((column) => column.stage === "qc")).toMatchObject({ total: 0, jobs: [] });
  });
});
