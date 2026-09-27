/**
 * The rest of the partner zone's account (F5 5.3): **claims** that name the factory (D-082,
 * D-083) with their evidence, the factory's response and the deductions they cause; the
 * factory's own monthly **scorecard** (D-155); its **users and roles** (Owner only, D-140); and
 * each user's **notification preferences** — partner-zone push, LINE, e-mail (D-143).
 *
 * Shapes from schema-design (`claims` with `factory_response`, `vendor_deductions`,
 * `factory_scorecards`, `user_roles` scoped to the factory) and the store's published
 * `NotificationPreferenceDto` (category × channel × enabled). A factory sees nothing of the
 * customer beyond what D-142 allows — no name on a claim, only the recipient's delivery facts.
 */

import { z } from "zod";

import { claimStatus, claimType } from "./admin-orders";
import { date, dateTime, fileRef, listQuery, money, page, pct, request, uuid } from "./define";

export const factoryClaimResponse = z.enum(["accepted", "disputed"]).meta({ id: "FactoryClaimResponse" });

export const partnerClaimSummary = z
  .object({
    id: uuid(),
    claimNo: z.string(),
    type: claimType,
    status: claimStatus,
    job: z.object({ id: uuid().nullable(), jobNo: z.string().nullable() }),
    shipmentNo: z.string().nullable(),
    submittedAt: dateTime(),
    /** Whose it is by D-083's rules, as Packio decided it. */
    liability: z.enum(["factory", "customer", "carrier", "packio", "undetermined"]),
    factoryResponse: factoryClaimResponse.nullable(),
    /** Answer by this time, when Packio asked for one. */
    responseDueAt: dateTime().nullable(),
    deduction: money().nullable(),
  })
  .meta({ id: "PartnerClaimSummaryDto" });

export const partnerClaim = partnerClaimSummary
  .extend({
    description: z.string(),
    requestedResolution: z.enum(["reprint", "partial_refund", "full_refund", "credit"]),
    claimedQuantity: z.number().int().nullable(),
    /** Product and shipping-carton photos (D-082), as short-lived signed URLs. */
    evidence: z.array(z.object({ role: z.enum(["product", "carton", "factory"]), file: fileRef() })),
    factoryNote: z.string().nullable(),
    factoryRespondedAt: dateTime().nullable(),
    decision: z.string().nullable(),
    deductions: z.array(
      z.object({
        id: uuid(),
        amount: money(),
        status: z.enum(["pending", "applied", "cancelled"]),
        appliedOn: date().nullable(),
      }),
    ),
    nextActions: z.array(z.enum(["respond"])),
  })
  .meta({ id: "PartnerClaimDto" });

export const partnerScorecard = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    jobsCount: z.number().int(),
    onTimeAcceptancePct: pct().nullable(),
    onTimeShippingPct: pct().nullable(),
    qcFirstPassPct: pct().nullable(),
    claimRatePct: pct().nullable(),
    onTimeUpdatesPct: pct().nullable(),
    computedAt: dateTime().nullable(),
  })
  .meta({ id: "PartnerScorecardDto" });

export const factoryRole = z
  .enum([
    "factory_owner",
    "factory_planner",
    "factory_operator",
    "factory_qc",
    "factory_shipping",
    "factory_accountant",
  ])
  .meta({ id: "FactoryRole" });

export const factoryUser = z
  .object({
    id: uuid(),
    displayName: z.string(),
    email: z.string().nullable(),
    roles: z.array(factoryRole),
    status: z.enum(["invited", "active", "deactivated"]),
    lastSignInAt: dateTime().nullable(),
    /** The signed-in owner cannot remove their own owner role (a factory keeps one owner). */
    isSelf: z.boolean(),
  })
  .meta({ id: "PartnerFactoryUserDto" });

export const partnerNotificationPreference = z
  .object({
    category: z.enum(["jobs", "shipping", "prices", "billing", "claims", "account"]),
    channel: z.enum(["web_push", "line", "email"]),
    enabled: z.boolean(),
    /** Some notices cannot be switched off (a job to accept, a dispute answer). */
    locked: z.boolean(),
  })
  .meta({ id: "PartnerNotificationPreferenceDto" });

const path = "/v1/partner/factories/{factoryId}";

export const partnerAccountRequests = {
  [`GET ${path}/claims` as const]: request({
    request: "partner.claims",
    summary: "Claims that name my factory, with their status and deductions (D-082, D-083)",
    decisions: ["D-082", "D-083"],
    query: listQuery({ status: claimStatus.optional() }),
    response: page(partnerClaimSummary),
  }),
  [`GET ${path}/claims/{claimId}` as const]: request({
    request: "partner.claims",
    summary: "One claim: evidence, Packio's decision, my factory's response, deductions",
    decisions: ["D-082", "D-083", "D-142"],
    response: partnerClaim,
  }),
  [`POST ${path}/claims/{claimId}/actions/respond` as const]: request({
    request: "partner.claims",
    summary: "Accept a claim or dispute it with a note and my own evidence",
    decisions: ["D-083"],
    body: z.object({
      response: factoryClaimResponse,
      note: z.string().trim().min(3).max(2000),
      evidenceFileIds: z.array(uuid()).max(10).optional(),
    }),
    response: partnerClaim,
    idempotent: true,
  }),
  [`GET ${path}/scorecards` as const]: request({
    request: "partner.scorecard",
    summary: "My factory's monthly scorecard, newest month first (D-155)",
    decisions: ["D-155", "D-075"],
    query: z.object({ months: z.coerce.number().int().min(1).max(24).optional() }),
    response: z.array(partnerScorecard),
  }),
  [`GET ${path}/users` as const]: request({
    request: "partner.users",
    summary: "The people who can act for my factory and their roles (Owner only)",
    decisions: ["D-140"],
    response: z.array(factoryUser),
  }),
  [`POST ${path}/users` as const]: request({
    request: "partner.users",
    summary: "Invite someone to act for my factory with one or more roles (Owner only)",
    decisions: ["D-140"],
    body: z.object({
      email: z.string().email(),
      displayName: z.string().trim().min(2).max(200),
      roles: z.array(factoryRole).min(1),
    }),
    response: factoryUser,
    status: 201,
  }),
  [`PATCH ${path}/users/{userId}` as const]: request({
    request: "partner.users",
    summary: "Change a user's roles, or deactivate / reactivate them (Owner only)",
    decisions: ["D-140"],
    body: z.object({
      roles: z.array(factoryRole).min(1).optional(),
      status: z.enum(["active", "deactivated"]).optional(),
    }),
    response: factoryUser,
  }),
  "GET /v1/partner/me/notification-preferences": request({
    request: "partner.notification-preferences",
    summary: "My notification channels per kind of factory event (D-143)",
    decisions: ["D-143"],
    response: z.object({ preferences: z.array(partnerNotificationPreference), lineLinked: z.boolean() }),
  }),
  "PUT /v1/partner/me/notification-preferences": request({
    request: "partner.notification-preferences",
    summary: "Set my notification channels; locked ones stay on",
    decisions: ["D-143"],
    body: z.object({
      preferences: z.array(partnerNotificationPreference.pick({ category: true, channel: true, enabled: true })),
    }),
    response: z.object({ preferences: z.array(partnerNotificationPreference), lineLinked: z.boolean() }),
  }),
} as const;
