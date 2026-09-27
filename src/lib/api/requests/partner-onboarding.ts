/**
 * What the partner zone's onboarding and price screens (F5 5.1) need beyond the published B2.2
 * partner surface. B2.2 covers the factory's own profile, steps and sign-off, KYC, bank account,
 * agreements, price lists and proposals, and the shipping rate card; what it leaves to the
 * Partner team — capability, capacity, delivery zones, tolerance, participation, site visits —
 * the factory can only read. These requests give the factory a voice there without letting it
 * write data Packio records (D-011, D-171):
 *
 * - `partner.references` — the catalogue names a factory's own screens show (product types, and
 *   the materials, print types and finishes its price lines refer to by id), so a price row reads
 *   "อาร์ตการ์ด 350 แกรม", not a uuid. Only the factory's own references (D-044).
 * - `partner.change-requests` — "please change this" to the Partner team: a capability, capacity
 *   or zone correction, a tolerance override (D-021, D-173), a request to move to tier A (D-043),
 *   preferred site-visit dates (D-041). Packio answers; the factory never edits those tables.
 * - `partner.site-visits` — the factory's own visit results (D-041), without inspector internals.
 * - `partner.proposal-evidence` — evidence attached to a price proposal (D-040 "reason/evidence"),
 *   as `attachments` with subject `price_proposal` (schema-design §5).
 *
 * Shapes follow schema-design (`factory_*`, `site_visits`, `attachments`) and api-conventions §3.
 */

import { z } from "zod";

import { date, dateTime, request, userRef, uuid } from "./define";

/* ------------------------------------------------------------------------- references */

export const priceReference = z
  .object({
    /** The price column that holds this id, e.g. `materialId`, `printTypeId`, `finishId`. */
    column: z.string(),
    id: uuid(),
    code: z.string().nullable(),
    name: z.string(),
  })
  .meta({ id: "PartnerPriceReferenceDto" });

export const partnerReferences = z
  .object({
    productTypes: z.array(z.object({ id: uuid(), code: z.string(), name: z.string() })),
    /** Every catalogue record the factory's price lines refer to, and those it may add lines for. */
    columns: z.array(priceReference),
  })
  .meta({ id: "PartnerReferencesDto" });

/* ---------------------------------------------------------------------- change requests */

export const changeRequestTopic = z
  .enum([
    "capability",
    "capacity",
    "delivery_zones",
    "tolerance",
    "participation_tier",
    "pricing_arrangement",
    "payout_policy",
    "site_visit",
    "profile",
    "other",
  ])
  .meta({ id: "FactoryChangeRequestTopic" });

export const changeRequestStatus = z
  .enum(["open", "in_progress", "done", "declined"])
  .meta({ id: "FactoryChangeRequestStatus" });

export const changeRequest = z
  .object({
    id: uuid(),
    topic: changeRequestTopic,
    /** The product type it is about, when it is about one (tier, capacity, tolerance). */
    productTypeId: uuid().nullable(),
    productTypeCode: z.string().nullable(),
    message: z.string(),
    /** Site visits: up to three dates the factory can host a visit. */
    preferredDates: z.array(date()),
    status: changeRequestStatus,
    /** The Partner team's answer. */
    response: z.string().nullable(),
    createdBy: userRef(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  })
  .meta({ id: "FactoryChangeRequestDto" });

/* ---------------------------------------------------------------------------- site visits */

export const partnerSiteVisit = z
  .object({
    id: uuid(),
    visitedOn: date(),
    result: z.enum(["pass", "conditional", "fail"]),
    /** What the factory is asked to fix, in Packio's words. */
    notes: z.string().nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "PartnerSiteVisitDto" });

/* -------------------------------------------------------------------- proposal evidence */

export const proposalEvidence = z
  .object({
    id: uuid(),
    fileId: uuid(),
    originalName: z.string(),
    note: z.string().nullable(),
    createdBy: userRef(),
    createdAt: dateTime(),
  })
  .meta({ id: "PriceProposalEvidenceDto" });

export const partnerOnboardingRequests = {
  "GET /v1/partner/factories/{factoryId}/references": request({
    request: "partner.references",
    summary: "Catalogue names for my factory's screens: product types and the records my price lines refer to",
    decisions: ["D-040", "D-044"],
    response: partnerReferences,
  }),
  "GET /v1/partner/factories/{factoryId}/change-requests": request({
    request: "partner.change-requests",
    summary: "My factory's requests to the Partner team, newest first",
    decisions: ["D-011", "D-043", "D-041"],
    response: z.array(changeRequest),
  }),
  "POST /v1/partner/factories/{factoryId}/change-requests": request({
    request: "partner.change-requests",
    summary: "Ask the Partner team to change data it records for my factory (never a direct edit)",
    decisions: ["D-011", "D-021", "D-043", "D-041", "D-173"],
    body: z.object({
      topic: changeRequestTopic,
      productTypeId: uuid().optional(),
      message: z.string().trim().min(3).max(2000),
      preferredDates: z.array(date()).max(3).optional(),
    }),
    response: changeRequest,
    status: 201,
  }),
  "GET /v1/partner/factories/{factoryId}/site-visits": request({
    request: "partner.site-visits",
    summary: "My factory's site visits and their results (D-041), newest first",
    decisions: ["D-041"],
    response: z.array(partnerSiteVisit),
  }),
  "GET /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence": request({
    request: "partner.proposal-evidence",
    summary: "Evidence attached to my price proposal",
    decisions: ["D-040"],
    response: z.array(proposalEvidence),
  }),
  "POST /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence": request({
    request: "partner.proposal-evidence",
    summary: "Attach an uploaded file as evidence to my draft or open price proposal",
    decisions: ["D-040"],
    body: z.object({ fileId: uuid(), note: z.string().trim().max(500).optional() }),
    response: proposalEvidence,
    status: 201,
  }),
} as const;
