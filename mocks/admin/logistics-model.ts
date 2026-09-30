/**
 * The shape the fake claims are kept in — the claim page F2 asked for (`ClaimDetailDto`), now only
 * a fixture model. The published claim is `AdminClaimDto`; `./logistics.ts` turns a row into it on
 * the way out (`toAdminClaimDto`), and the storefront and partner mocks read the same rows. Kept
 * as zod so the rows stay checked while they are built.
 */

import { z } from "zod";

import { claimResolutionKind } from "@/lib/api/requests/admin-logistics";
import { claimStatus, claimType, customerRef, factoryRef } from "@/lib/api/requests/admin-orders";
import { dateTime, fileRef, money, userRef, uuid } from "@/lib/api/requests/define";

export const claimOrigin = z.enum(["customer", "tolerance_auto", "staff"]);
export const claimLiability = z.enum(["factory", "customer", "carrier", "packio", "undetermined"]);
export const claimActionKey = z.enum(["start-review", "request-info", "send-to-factory", "approve", "reject", "close"]);
export const claimResolutionAction = z.enum([
  "reproduction_job",
  "refund",
  "credit_note",
  "store_credit",
  "factory_deduction",
  "carrier_recovery",
]);

export const claimRow = z.object({
  id: uuid(),
  claimNo: z.string(),
  type: claimType,
  origin: claimOrigin,
  status: claimStatus,
  order: z.object({ id: uuid(), orderCode: z.string() }),
  customer: customerRef,
  factory: factoryRef.nullable(),
  requestedResolution: claimResolutionKind,
  claimedAmount: money().nullable(),
  liability: claimLiability,
  submittedAt: dateTime(),
  /** The SLA of the current step on the business calendar. */
  slaDueAt: dateTime().nullable(),
});

export const claimDetail = claimRow.extend({
  shipment: z.object({ id: uuid(), shipmentNo: z.string() }).nullable(),
  description: z.string(),
  receivedAt: dateTime(),
  windowEndsAt: dateTime(),
  claimedQuantity: z.number().int().nullable(),
  evidence: z.object({ productPhotos: z.array(fileRef()), cartonPhotos: z.array(fileRef()) }),
  /** What D-083 gives by rule, and whether a person overrode it. */
  liabilityByRule: claimLiability,
  liabilityRule: z.string(),
  liabilityOverride: z.object({ by: userRef(), reason: z.string(), at: dateTime() }).nullable(),
  /** The artwork the customer approved, when liability may turn on it (D-083). */
  approvedProof: z.object({ id: uuid(), versionNo: z.number().int(), approvedAt: dateTime() }).nullable(),
  factoryResponse: z
    .object({ response: z.enum(["accepted", "disputed"]), note: z.string().nullable(), at: dateTime() })
    .nullable(),
  decision: z.object({ by: userRef(), at: dateTime(), reason: z.string() }).nullable(),
  resolutions: z.array(
    z.object({
      action: claimResolutionAction,
      amount: money().nullable(),
      reference: z.string().nullable(),
      executedAt: dateTime(),
      executedBy: userRef(),
    }),
  ),
  messages: z.array(
    z.object({
      at: dateTime(),
      author: z.string(),
      audience: z.enum(["customer", "factory", "internal"]),
      body: z.string(),
    }),
  ),
  allowedActions: z.array(claimActionKey),
  allowedResolutions: z.array(claimResolutionAction),
});
