/**
 * The shape the fake production floor is kept in — the board job and the inspection F2 asked for,
 * now only fixture models. The published ones are `AdminJobDto` (`./orders.ts`) and
 * `InspectionDto` (`./governance.ts`, `toInspectionDto`); the partner mocks read the same rows.
 */

import { z } from "zod";

import { factoryRef, milestoneStatus, productionJobStatus, productTypeRef } from "@/lib/api/requests/admin-orders";
import { date, dateTime, userRef, uuid } from "@/lib/api/requests/define";

export const boardJob = z.object({
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
});

export const inspectionReason = z.enum([
  "value_100_pct",
  "value_band_sample",
  "trial_factory",
  "high_defect_factory",
  "special_finish_or_food",
]);

export const inspectionStatus = z.enum(["planned", "in_progress", "passed", "failed", "waived"]);

export const inspection = z.object({
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
});
