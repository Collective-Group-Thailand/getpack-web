/**
 * The production floor as the back office reads it (U-F0.4): `admin.production.list` / `get`
 * (with factory and product-type filters), `admin.production.board` (the API's columns by current
 * milestone, with totals and at-risk counts), and a job's QC checks and issues — over the commerce
 * mock's own jobs and **what the factory reported on them** (`../partner/jobs.ts`), so a milestone a
 * factory completes moves the job on the board and on the order's Production tab.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { jobCore, extraOf, ROUTE } from "../partner/jobs";
import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, paginate, problem } from "../support";
import { FACTORY, orders, type MockOrder } from "./commerce";
import { adminJobActions } from "./floor-actions";
import { inspections } from "./governance";

type Job = MockOrder["jobs"][number];

/** The jobs on the floor; completed, cancelled and rejected ones leave the board. */
const LIVE = ["released", "accepted", "in_progress", "on_hold"];

/** A production job as `admin.production.*` answers it: masked by D-141, with the reader's actions. */
export function toAdminJobDto(order: MockOrder, job: Job, who: StaffPersona | null): Schemas["AdminJobDto"] {
  const factory = job.factory ?? FACTORY;
  const core = jobCore(order, job);
  const inspection = inspections.find((candidate) => candidate.job.id === job.id);
  return {
    ...core,
    orderId: order.id,
    orderCode: order.orderCode,
    factoryId: factory.id,
    factoryCode: factory.code,
    releaseMode: order.startMode ?? "auto",
    releaseReason: null,
    escalatedAt: null,
    // The SLA engine's predicted finish, past the promise when the job is at risk (D-075).
    predictedFinishOn: job.atRisk ? bangkokIso(60 * 24 * 3).slice(0, 10) : null,
    // D-141: what Packio pays the factory, for factory_buy_prices.read only.
    buyCostNet: who && can(who, "factory_buy_prices.read") ? (order.margin?.buyCostNet ?? null) : null,
    buyPriceNet: who && can(who, "factory_buy_prices.read") ? (order.margin?.buyCostNet ?? null) : null,
    inspectionReasons: inspection?.reasons ?? (core.inspectionRequired ? ["value_band_sample"] : []),
    assignments: [],
    nextActions: adminJobActions({ status: job.status, jobKind: job.kind }, new Set(who?.permissions ?? [])),
  };
}

function allowed(request: Request, permission: string): StaffPersona | null {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const noJob = () => problem(404, "http.not_found", "ไม่พบงานผลิตนี้");

const allJobs = () => orders.flatMap((order) => order.jobs.map((job) => ({ order, job })));
const findJob = (jobId: unknown) => allJobs().find(({ job }) => job.id === jobId);

/** The filters `admin.production.list` and `.board` share. */
function filtered(url: URL) {
  const factoryId = url.searchParams.get("factoryId");
  const productTypeCode = url.searchParams.get("productTypeCode");
  return allJobs()
    .filter(({ job }) => !factoryId || (job.factory ?? FACTORY).id === factoryId)
    .filter(({ order }) => !productTypeCode || order.productType.code === productTypeCode);
}

const current = (job: Job) => job.milestones.find((step) => step.status !== "completed" && step.status !== "skipped");

export const productionHandlers = [
  // admin.production.board (v0.5.0): live jobs counted by the step they are at, in route order.
  http.get("*/v1/admin/production-board", ({ request }) => {
    if (!allowed(request, "production.read")) return forbidden();
    const live = filtered(new URL(request.url)).filter(({ job }) => LIVE.includes(job.status));
    const keyOf = (job: Job) =>
      job.status === "released" || job.milestones.length === 0
        ? "awaiting_acceptance"
        : (current(job)?.key ?? job.milestones.at(-1)!.key);
    const columns: Schemas["BoardColumnDto"][] = [
      { key: "awaiting_acceptance", labelTh: "รอรับงาน", labelEn: "Awaiting acceptance", total: 0, atRisk: 0 },
      ...ROUTE.map((step) => ({ key: step.key, labelTh: step.nameTh, labelEn: step.nameEn, total: 0, atRisk: 0 })),
    ];
    for (const { job } of live) {
      const column = columns.find((item) => item.key === keyOf(job));
      if (!column) continue;
      column.total += 1;
      if (job.atRisk) column.atRisk += 1;
    }
    return HttpResponse.json({
      total: live.length,
      atRisk: live.filter(({ job }) => job.atRisk).length,
      columns: columns.filter((column) => column.total > 0),
    } satisfies Schemas["ProductionBoardDto"]);
  }),

  // admin.production.list: the order page's Production tab (`?orderId=`) and the production board.
  http.get("*/v1/admin/production-jobs", ({ request }) => {
    const who = allowed(request, "production.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    const status = url.searchParams.get("status");
    const queue = url.searchParams.get("queue");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = filtered(url)
      .filter(({ order }) => !orderId || order.id === orderId)
      .map(({ order, job }) => toAdminJobDto(order, job, who))
      .filter((job) => !status || job.status === status)
      .filter(
        (job) =>
          !queue ||
          (queue === "at_risk" && job.atRisk) ||
          (queue === "awaiting_acceptance" && job.status === "released") ||
          (queue === "escalated" && job.escalatedAt !== null),
      )
      .filter((job) => matchesQuery(q, job.jobNo, job.orderCode, job.factoryCode));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.get("*/v1/admin/production-jobs/:jobId", ({ params, request }) => {
    const who = allowed(request, "production.read");
    if (!who) return forbidden();
    const found = findJob(params.jobId);
    return found ? HttpResponse.json(toAdminJobDto(found.order, found.job, who)) : noJob();
  }),
  http.get("*/v1/admin/production-jobs/:jobId/qc-checks", ({ params, request }) => {
    if (!allowed(request, "production.read")) return forbidden();
    const found = findJob(params.jobId);
    return found ? HttpResponse.json(extraOf(found.job).qcChecks) : noJob();
  }),
  http.get("*/v1/admin/production-jobs/:jobId/issues", ({ params, request }) => {
    if (!allowed(request, "production.read")) return forbidden();
    const found = findJob(params.jobId);
    return found ? HttpResponse.json(extraOf(found.job).issues) : noJob();
  }),
];
