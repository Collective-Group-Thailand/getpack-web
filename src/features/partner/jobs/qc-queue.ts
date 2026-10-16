import type { Schemas } from "@/lib/api/types";

import { needsQcForm } from "./evidence";

type Job = Schemas["PartnerJobDto"];

export interface QcQueue {
  /** getpack's inspector is booked: soonest first. */
  inspections: Job[];
  /** The job stands at a step whose evidence is the QC form, and the factory may record it. */
  atQc: Job[];
}

/**
 * The QC inspector's queue (round 2, Phase 1 — the "PartnerQc" board): jobs getpack will inspect,
 * soonest first, and jobs that reached a step needing the QC form and offer `job.record_qc`. A
 * job finished, cancelled or rejected is never in it.
 */
export function qcQueue(jobs: readonly Job[]): QcQueue {
  const open = jobs.filter((job) => ["accepted", "in_progress", "on_hold"].includes(job.status));
  const inspections = open
    .filter((job) => job.inspection && ["planned", "in_progress"].includes(job.inspection.status))
    .sort((a, b) => (a.inspection!.scheduledAt ?? "9").localeCompare(b.inspection!.scheduledAt ?? "9"));
  const atQc = open.filter((job) => {
    const current = job.milestones.find((step) => step.key === job.currentMilestoneKey);
    return Boolean(current && needsQcForm(current) && job.nextActions.some((a) => a.key === "job.record_qc"));
  });
  return { inspections, atQc };
}
