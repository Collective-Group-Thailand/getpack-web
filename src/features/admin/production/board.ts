/**
 * The production board's columns, grouped on the client from `admin.production.list`.
 *
 * CONTRACT-GAP admin.production-board — the API does not group jobs by their current milestone,
 * count each column or its at-risk jobs, or name the current milestone on the job (U-B0.2). Until
 * it does, the board groups the page it read here: the current milestone is the first one not yet
 * completed or skipped (the last one when all are), and a job the factory has not accepted has no
 * milestones yet, so it waits in its own column. Counting is all it does — no dates or money.
 */

import type { Schemas } from "@/lib/api/types";

type Job = Schemas["AdminJobDto"];

/** The jobs on the floor; completed, cancelled and rejected ones leave the board. */
export const LIVE_JOB_STATUSES = [
  "released",
  "accepted",
  "in_progress",
  "on_hold",
] as const satisfies readonly Schemas["ProductionJobStatus"][];

export interface BoardColumn {
  /** The milestone key, or `null` for the jobs waiting for acceptance. */
  key: string | null;
  seq: number;
  nameTh: string;
  nameEn: string;
  jobs: Job[];
  atRisk: number;
}

export function currentMilestone(job: Pick<Job, "milestones">): Job["milestones"][number] | null {
  const steps = [...job.milestones].sort((a, b) => a.seq - b.seq);
  return steps.find((step) => step.status === "pending" || step.status === "in_progress") ?? steps.at(-1) ?? null;
}

export function boardColumns(jobs: readonly Job[]): BoardColumn[] {
  const columns = new Map<string | null, BoardColumn>();
  for (const job of jobs) {
    if (!(LIVE_JOB_STATUSES as readonly string[]).includes(job.status)) continue;
    const step = currentMilestone(job);
    const columnKey = step?.key ?? null;
    let column = columns.get(columnKey);
    if (!column) {
      column = {
        key: columnKey,
        seq: step?.seq ?? 0,
        nameTh: step?.nameTh ?? "",
        nameEn: step?.nameEn ?? "",
        jobs: [],
        atRisk: 0,
      };
      columns.set(columnKey, column);
    }
    column.jobs.push(job);
    if (job.atRisk) column.atRisk += 1;
  }
  return [...columns.values()].sort((a, b) => a.seq - b.seq);
}
