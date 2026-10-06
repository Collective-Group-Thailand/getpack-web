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

/**
 * The board's six fixed stages (UX audit, /production): every stage is a column, with or without
 * jobs, in the order work flows. Route step keys are per product (a route template's own keys), so
 * each one is placed in a stage by what it is; a key the board does not recognise sits with the
 * post-press work, where most of a route's own steps are.
 */
export const STAGES = ["awaiting", "materials", "printing", "post_press", "qc", "ready"] as const;
export type Stage = (typeof STAGES)[number];

export function stageOf(key: string): Stage {
  if (key === AWAITING_ACCEPTANCE) return "awaiting";
  if (/receiv|material|paper|board|stock|prepare/.test(key)) return "materials";
  if (/print|plate|offset|flexo|digital/.test(key)) return "printing";
  if (/qc|inspect|quality|check/.test(key)) return "qc";
  if (/ready|pack|ship|dispatch|deliver/.test(key)) return "ready";
  return "post_press";
}

export interface StageColumn {
  stage: Stage;
  total: number;
  atRisk: number;
  jobs: Job[];
}

/** The API's columns gathered into the six stages; counts are the API's, summed per stage. */
export function stageColumns(columns: readonly Column[], jobs: readonly Job[]): StageColumn[] {
  const placed = boardColumns(columns, jobs);
  return STAGES.map((stage) => {
    const mine = placed.filter((column) => stageOf(column.key) === stage);
    return {
      stage,
      total: mine.reduce((sum, column) => sum + column.total, 0),
      atRisk: mine.reduce((sum, column) => sum + column.atRisk, 0),
      jobs: mine.flatMap((column) => column.jobs),
    };
  });
}
