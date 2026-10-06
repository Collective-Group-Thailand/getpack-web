import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { qcQueue } from "./qc-queue";

const job = (over: Partial<Schemas["PartnerJobDto"]>) =>
  ({
    id: "j",
    jobNo: "J",
    status: "in_progress",
    inspection: null,
    milestones: [],
    currentMilestoneKey: null,
    nextActions: [],
    ...over,
  }) as unknown as Schemas["PartnerJobDto"];

describe("qcQueue (round 2, Phase 1)", () => {
  it("lists booked inspections soonest first and jobs waiting at a QC-form step", () => {
    const step = { key: "qc", evidence: "qc_form" };
    const queue = qcQueue([
      job({ id: "late", inspection: { status: "planned", scheduledAt: "2026-10-09T10:00:00+07:00" } as never }),
      job({ id: "soon", inspection: { status: "planned", scheduledAt: "2026-10-07T10:00:00+07:00" } as never }),
      job({ id: "atqc", milestones: [step] as never, currentMilestoneKey: "qc", nextActions: [{ key: "job.record_qc" }] as never }),
      job({ id: "done", status: "completed", inspection: { status: "planned", scheduledAt: null } as never }),
      job({ id: "noperm", milestones: [step] as never, currentMilestoneKey: "qc" }),
    ]);
    expect(queue.inspections.map((j) => j.id)).toEqual(["soon", "late"]);
    expect(queue.atQc.map((j) => j.id)).toEqual(["atqc"]);
  });
});
