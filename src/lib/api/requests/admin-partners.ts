/**
 * Requests for the production floor the published contract does not cover yet (F2 2.6): the
 * **production board, inspections, scorecards** (B4.2, D-075, D-076, D-155), shaped by
 * schema-design §3.7 (`production_jobs`, `job_milestones`, `inspections`, `factory_scorecards`).
 * Price suggestions, simulations, index series and coverage were requests too, until B2.2
 * published them.
 */

import { z } from "zod";

import { factoryRef, milestoneStatus, productTypeRef, productionJobStatus } from "./admin-orders";
import { date, dateTime, listQuery, page, pct, request, userRef, uuid } from "./define";

/* ---------------------------------------------------------------------- production (B4.2) */

export const boardJob = z
  .object({
    id: uuid(),
    jobNo: z.string(),
    order: z.object({ id: uuid(), orderCode: z.string() }),
    factory: factoryRef,
    productType: productTypeRef,
    quantity: z.number().int(),
    status: productionJobStatus,
    milestone: z.object({ key: z.string(), name: z.string(), status: milestoneStatus, dueAt: dateTime().nullable() }),
    promisedShipDate: date(),
    /** The SLA engine's predicted finish (B4.2); `atRisk` when it passes the promise. */
    predictedFinishOn: date().nullable(),
    atRisk: z.boolean(),
    riskReason: z.string().nullable(),
    inspectionRequired: z.boolean(),
  })
  .meta({ id: "ProductionBoardJobDto" });

export const productionBoard = z
  .object({
    columns: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        total: z.number().int(),
        atRisk: z.number().int(),
        jobs: z.array(boardJob),
      }),
    ),
  })
  .meta({ id: "ProductionBoardDto" });

export const inspectionReason = z
  .enum(["value_100_pct", "value_band_sample", "trial_factory", "high_defect_factory", "special_finish_or_food"])
  .meta({ id: "InspectionReason" });
export const inspectionStatus = z
  .enum(["planned", "in_progress", "passed", "failed", "waived"])
  .meta({ id: "InspectionStatus" });

export const inspection = z
  .object({
    id: uuid(),
    job: z.object({ id: uuid(), jobNo: z.string() }),
    order: z.object({ id: uuid(), orderCode: z.string() }),
    factory: factoryRef,
    productType: productTypeRef,
    reasons: z.array(inspectionReason),
    /** ISO 2859-1 general level II; AQL 0 / 2.5 / 4.0 by default (D-076, settings). */
    lotSize: z.number().int(),
    sampleSize: z.number().int(),
    aql: z.object({ critical: z.string(), major: z.string(), minor: z.string() }),
    /** Accept on at most this many defects of each class, from the sampling table. */
    acceptNumbers: z.object({ critical: z.number().int(), major: z.number().int(), minor: z.number().int() }),
    found: z.object({ critical: z.number().int(), major: z.number().int(), minor: z.number().int() }).nullable(),
    status: inspectionStatus,
    inspector: userRef().nullable(),
    scheduledAt: dateTime().nullable(),
    resultAt: dateTime().nullable(),
    notes: z.string().nullable(),
  })
  .meta({ id: "InspectionDto" });

export const scorecard = z
  .object({
    factory: factoryRef,
    month: z.string().regex(/^\d{4}-\d{2}$/),
    onTimeAcceptancePct: pct().nullable(),
    onTimeShippingPct: pct().nullable(),
    qcFirstPassPct: pct().nullable(),
    claimRatePct: pct().nullable(),
    onTimeUpdatesPct: pct().nullable(),
    jobsCount: z.number().int(),
    computedAt: dateTime(),
  })
  .meta({ id: "FactoryScorecardDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminPartnerRequests = {
  "GET /v1/admin/production-board": request({
    request: "admin.production-board",
    summary: "Jobs by current milestone, with the at-risk flag of the SLA engine (B4.2, D-075)",
    decisions: ["D-074", "D-075"],
    query: z.object({
      factoryId: uuid().optional(),
      productType: z.string().optional(),
      atRisk: z.enum(["true"]).optional(),
    }),
    response: productionBoard,
  }),
  "GET /v1/admin/inspections": request({
    request: "admin.inspections",
    summary: "Packio's risk-based QC inspections (D-076)",
    decisions: ["D-076"],
    query: listQuery({ status: inspectionStatus.optional(), factoryId: uuid().optional() }),
    response: page(inspection),
  }),
  "POST /v1/admin/inspections/{inspectionId}/actions/record": request({
    request: "admin.inspections",
    summary: "Record an inspection's defect counts; the API judges pass or fail against the accept numbers",
    decisions: ["D-076"],
    body: z.object({
      found: z.object({
        critical: z.number().int().min(0),
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
      }),
      notes: z.string().max(2000).optional(),
      photoFileIds: z.array(uuid()).max(20).optional(),
    }),
    response: inspection,
    idempotent: true,
  }),
  "GET /v1/admin/scorecards": request({
    request: "admin.scorecards",
    summary: "Every factory's monthly scorecard (D-155)",
    decisions: ["D-155", "D-075"],
    query: z.object({
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    }),
    response: z.object({ month: z.string(), data: z.array(scorecard) }),
  }),
} as const;
