/**
 * The production board's columns: the API's (`admin.production.board` — the step open jobs are
 * at, in route order, with `awaiting_acceptance` first, and each column's total and at-risk
 * count), filled with the jobs `admin.production.list` reads, each in the column of its
 * `currentMilestoneKey` (a job not yet accepted waits in `awaiting_acceptance`). The counts are
 * the API's; the page only places the cards it read.
 */

import type { Schemas } from "@/lib/api/types";

type Job = Schemas["AdminJobDto"];
type Column = Schemas["BoardColumnDto"];

/** The jobs on the floor; completed, cancelled and rejected ones leave the board. */
export const LIVE_JOB_STATUSES = [
  "released",
  "accepted",
  "in_progress",
  "on_hold",
] as const satisfies readonly Schemas["ProductionJobStatus"][];

export const AWAITING_ACCEPTANCE = "awaiting_acceptance";

export interface BoardColumn extends Column {
  jobs: Job[];
}

/** The column a job sits in. */
export const columnKeyOf = (job: Pick<Job, "status" | "currentMilestoneKey">) =>
  job.status === "released" || !job.currentMilestoneKey ? AWAITING_ACCEPTANCE : job.currentMilestoneKey;

export function boardColumns(columns: readonly Column[], jobs: readonly Job[]): BoardColumn[] {
  const live = jobs.filter((job) => (LIVE_JOB_STATUSES as readonly string[]).includes(job.status));
  return columns.map((column) => ({ ...column, jobs: live.filter((job) => columnKeyOf(job) === column.key) }));
}
