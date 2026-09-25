/**
 * Requests for partner governance the published B2.2 contract does not cover yet (F2 2.6).
 *
 * - **Price suggestions and impact simulations** and **index series** mirror packio-api's
 *   work in progress (`src/modules/partners/pricing/pricing.dto.ts`, `index-series/`, 2026-09-26)
 *   field for field, so they retire the day it is published. Staff only: `price_suggestions.read`
 *   (D-040 note, D-044) — never shown to a factory.
 * - **Coverage** (D-043): per product type, whether an instant price path exists and which
 *   factories cover it — B2's quote-path resolution, as a read for admins.
 * - **Production board, inspections, scorecards** (B4.2, D-075, D-076, D-155), shaped by
 *   schema-design §3.7 (`production_jobs`, `job_milestones`, `inspections`, `factory_scorecards`).
 */

import { z } from "zod";

import { factoryRef, milestoneStatus, productTypeRef, productionJobStatus } from "./admin-orders";
import { date, dateTime, listQuery, page, pct, request, userRef, uuid } from "./define";

/* ----------------------------------------------------------------------- suggestions (WIP) */

export const suggestionMethod = z
  .enum(["material_index", "own_history_driver", "peer_benchmark", "waste_actuals", "shipping_margin", "none"])
  .meta({ id: "SuggestionMethod" });
export const simulationStatus = z.enum(["queued", "running", "succeeded", "failed"]).meta({ id: "JobStatus" });

export const priceLineSuggestion = z
  .object({
    lineId: uuid(),
    component: z.string(),
    lineKey: z.string(),
    group: z.string().nullable(),
    method: suggestionMethod,
    /** The suggested line; `null` when no method applies. */
    suggestedValues: z.record(z.string(), z.unknown()).nullable(),
    /** Series and points, ratios, peer count and percentiles — never another factory's identity. */
    basis: z.record(z.string(), z.unknown()),
    /** (proposed − suggested) ÷ suggested × 100 on the primary value column. */
    deviationPct: pct().nullable(),
    /** e.g. `above_band` (only once the band setting exists, D-172), `peers_below_minimum`, `index_point_missing`. */
    flags: z.array(z.string()),
    computedAt: dateTime(),
  })
  .meta({ id: "PriceLineSuggestionDto" });

export const priceSuggestions = z
  .object({ proposalId: uuid(), computedAt: dateTime().nullable(), lines: z.array(priceLineSuggestion) })
  .meta({ id: "PriceSuggestionsDto" });

export const priceSimulation = z
  .object({
    id: uuid(),
    proposalId: uuid(),
    status: simulationStatus,
    windowFrom: dateTime(),
    windowTo: dateTime(),
    /** Quotes re-priced, price and margin change, change in selection share (D-040 note). */
    result: z
      .object({
        quotesInWindow: z.number().int(),
        priceChangePct: pct().nullable(),
        marginChangePct: pct().nullable(),
        selectionShareChangePct: pct().nullable(),
      })
      .nullable(),
    error: z.string().nullable(),
    createdAt: dateTime(),
    completedAt: dateTime().nullable(),
  })
  .meta({ id: "PriceSimulationDto" });

/* --------------------------------------------------------------------- index series (WIP) */

export const indexKind = z.enum(["material", "cost_driver"]).meta({ id: "IndexKind" });
export const indexSource = z.enum(["manual", "feed"]).meta({ id: "IndexSource" });
const period = () => z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const indexPoint = z
  .object({ period: period(), value: z.string(), sourceRef: z.string().nullable(), updatedAt: dateTime() })
  .meta({ id: "IndexPointDto" });

export const indexSeries = z
  .object({
    id: uuid(),
    code: z.string(),
    kind: indexKind,
    materialFamilyId: uuid().nullable(),
    nameTh: z.string(),
    nameEn: z.string(),
    unit: z.string(),
    source: indexSource,
    adapterKey: z.string().nullable(),
    latestPoint: indexPoint.nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "IndexSeriesDto" });

/* --------------------------------------------------------------------------------- coverage */

export const coverageRow = z
  .object({
    productType: productTypeRef.extend({ id: uuid() }),
    quoteMode: z.enum(["instant", "rfq"]),
    calculatorKey: z.string().nullable(),
    /** At least one active factory quotes it instantly: tier A, or tier B within its envelope (D-043). */
    instantPath: z.boolean(),
    factories: z.array(
      z.object({
        factory: factoryRef,
        tier: z.enum(["A", "B", "C"]),
        envelopeNote: z.string().nullable(),
        factoryStatus: z.string(),
      }),
    ),
  })
  .meta({ id: "CoverageRowDto" });

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
  "GET /v1/admin/price-proposals/{proposalId}/suggestions": request({
    request: "admin.price-suggestions",
    summary: "Staff-only suggested values, basis and deviation per proposal line (D-040 note, D-044)",
    decisions: ["D-040", "D-044", "D-172"],
    response: priceSuggestions,
  }),
  "POST /v1/admin/price-proposals/{proposalId}/suggestions/actions/recompute": request({
    request: "admin.price-suggestions",
    summary: "Recompute the suggestions (after an index point or a benchmark changes)",
    response: priceSuggestions,
  }),
  "POST /v1/admin/price-proposals/{proposalId}/simulations": request({
    request: "admin.price-suggestions",
    summary: "Start an impact simulation: the factory's quotes of the window re-priced with the proposed values",
    response: priceSimulation,
    status: 202,
  }),
  "GET /v1/admin/price-proposals/{proposalId}/simulations/{simulationId}": request({
    request: "admin.price-suggestions",
    summary: "Poll a simulation",
    response: priceSimulation,
  }),
  "GET /v1/admin/index-series": request({
    request: "admin.index-series",
    summary: "Material price and cost-driver index series (D-040)",
    query: listQuery({ kind: indexKind.optional() }),
    response: page(indexSeries),
  }),
  "POST /v1/admin/index-series": request({
    request: "admin.index-series",
    summary: "Create an index series",
    body: z.object({
      code: z.string().regex(/^[a-z][a-z0-9_.]*$/),
      kind: indexKind,
      materialFamilyId: uuid().nullable().optional(),
      nameTh: z.string().min(1),
      nameEn: z.string().min(1),
      unit: z.string().min(1),
      source: indexSource.optional(),
    }),
    response: indexSeries,
    status: 201,
  }),
  "GET /v1/admin/index-series/{seriesId}/points": request({
    request: "admin.index-series",
    summary: "The monthly values of a series, oldest first",
    query: z.object({ from: period().optional(), to: period().optional() }),
    response: z.array(indexPoint),
  }),
  "PUT /v1/admin/index-series/{seriesId}/points/{period}": request({
    request: "admin.index-series",
    summary: "Record the value of a series for a month",
    body: z.object({
      value: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/),
      sourceRef: z.string().max(200).nullable().optional(),
    }),
    response: indexPoint,
  }),
  "GET /v1/admin/catalog/coverage": request({
    request: "admin.coverage",
    summary: "Per product type: an instant price path or RFQ only, and which factories cover it at which tier (D-043)",
    decisions: ["D-043", "D-100"],
    response: z.object({ data: z.array(coverageRow) }),
  }),
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
