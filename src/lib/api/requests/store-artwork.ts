/**
 * Artwork, proofs and design services from the customer's side (F3 3.5, B4.1, D-070–D-072).
 *
 * The back office's prepress workspace (`admin-prepress.ts`, F2 2.4) holds the same rows: a file
 * the customer submits is the submission prepress checks, a proof prepress sends is the proof the
 * customer reviews, an annotation is one thread both reply to. What differs is visibility:
 * staff appear as the team, internal notes never leave, and the proof arrives as page images
 * the viewer can zoom and annotate (the API rasterises the PDF) with the dieline as its own
 * overlay.
 *
 * Approval is evidence (B4.1): the API records who approved which file (its hash), when, from
 * where, and which checklist items they confirmed. The browser only sends the confirmation.
 */

import { z } from "zod";

import { artworkStatus, designOption, preflightFinding, preflightStatus, proofStatus } from "./admin-orders";
import {
  annotationKind,
  artworkFileRole,
  designRoundKind,
  designRoundStatus,
  designServiceStatus,
  submissionStatus,
} from "./admin-prepress";
import { dateTime, fileRef, money, nextAction, request, uuid } from "./define";
import { rfqField } from "./store-rfq";

/* ----------------------------------------------------------------------------------- artwork */

export const artworkRules = z
  .object({
    accept: z.string(),
    maxBytes: z.number().int(),
    maxFiles: z.number().int(),
    /** D-070 checks in words the customer can act on — from settings, never hard-coded. */
    bleedMm: z.number(),
    safeMarginMm: z.number(),
    minDpi: z.number().int(),
    colourMode: z.enum(["cmyk", "any"]).meta({ id: "ArtworkColourMode" }),
  })
  .meta({ id: "ArtworkRulesDto" });

export const storeSubmission = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    status: submissionStatus,
    preflightStatus,
    /** Blocking findings stop the file (size, bleed); warnings do not (resolution, RGB) — D-070. */
    findings: z.array(preflightFinding),
    files: z.array(z.object({ role: artworkFileRole, file: fileRef() })),
    note: z.string().nullable(),
    /** Why prepress sent it back, when it did. */
    rejectionReason: z.string().nullable(),
    submittedAt: dateTime(),
  })
  .meta({ id: "StoreSubmissionDto" });

export const proofPage = z
  .object({
    index: z.number().int(),
    imageUrl: z.string(),
    widthPx: z.number().int(),
    heightPx: z.number().int(),
    /** The dieline for this page as a transparent overlay of the same size, when there is one. */
    dielineOverlayUrl: z.string().nullable(),
  })
  .meta({ id: "ProofPageDto" });

export const storeProof = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    status: proofStatus,
    note: z.string().nullable(),
    file: fileRef(),
    pages: z.array(proofPage),
    sentAt: dateTime(),
    decidedAt: dateTime().nullable(),
    /** The approval record, read back: who, when, which file hash (B4.1 evidence). */
    decision: z
      .object({
        outcome: z.enum(["approved", "changes_requested"]).meta({ id: "ProofDecisionOutcome" }),
        byName: z.string(),
        at: dateTime(),
        note: z.string().nullable(),
        fileSha256: z.string().nullable(),
        checklist: z.array(z.string()),
      })
      .nullable(),
    annotations: z.object({ open: z.number().int(), resolved: z.number().int() }),
  })
  .meta({ id: "StoreProofDto" });

export const storeDesignService = z
  .object({
    status: designServiceStatus,
    /** The brief's questions (rendered by the API), and whether it has been answered. */
    briefFields: z.array(rfqField),
    brief: z.array(z.object({ label: z.string(), value: z.string() })),
    briefSubmitted: z.boolean(),
    targetDueAt: dateTime().nullable(),
    maxDueAt: dateTime().nullable(),
    /** D-071: 3 free revision rounds (setting snapshot); round 4 on is charged. */
    freeRounds: z.number().int(),
    rounds: z.array(
      z.object({
        roundNo: z.number().int(),
        kind: designRoundKind,
        chargeable: z.boolean(),
        feeAmount: money().nullable(),
        status: designRoundStatus,
        requestedAt: dateTime(),
        deliveredAt: dateTime().nullable(),
        files: z.array(fileRef()),
        note: z.string().nullable(),
      }),
    ),
    /** What the next revision costs — `max(THB 500, 20 % of the design fee)` computed by the API. */
    nextRound: z.object({ roundNo: z.number().int(), chargeable: z.boolean(), feeAmount: money().nullable() }),
    /** A paid round waiting for its fee: pay this instalment first (D-071). */
    pendingFeeInstalment: z
      .object({ id: uuid(), label: z.string(), grossAmount: money(), activePaymentId: uuid().nullable() })
      .nullable(),
  })
  .meta({ id: "StoreDesignServiceDto" });

export const storeArtwork = z
  .object({
    orderId: uuid(),
    orderCode: z.string(),
    artworkStatus,
    designOption,
    rules: artworkRules,
    dieline: z.object({
      /** `@packio/dieline` style, for the 3D preview and the online designer. */
      dielineKey: z.string().nullable(),
      lengthMm: z.number().int().nullable(),
      widthMm: z.number().int().nullable(),
      heightMm: z.number().int().nullable(),
      /** The template to lay artwork out on (B4.1 dieline delivery), as a signed URL. */
      templateUrl: z.string().nullable(),
    }),
    /** Newest first. */
    submissions: z.array(storeSubmission),
    /** Newest first. */
    proofs: z.array(storeProof),
    /** What the customer confirms before approving — from settings. */
    checklist: z.array(z.object({ key: z.string(), label: z.string() })),
    designService: storeDesignService.nullable(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "StoreArtworkDto" });

export const storeAnnotationThread = z
  .object({
    id: uuid(),
    proofId: uuid(),
    page: z.number().int(),
    kind: annotationKind,
    /** Page-relative 0–1: `{ x, y }` for a pin, `{ x, y, w, h }` for a box. */
    geometry: z.record(z.string(), z.number()),
    resolved: z.boolean(),
    messages: z.array(
      z.object({
        id: uuid(),
        authorKind: z.enum(["customer", "staff"]),
        /** Staff appear as the team. */
        authorName: z.string(),
        body: z.string(),
        createdAt: dateTime(),
      }),
    ),
  })
  .meta({ id: "StoreAnnotationThreadDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeArtworkRequests = {
  "GET /v1/store/orders/{orderId}/artwork": request({
    request: "store.artwork",
    summary: "An order's artwork: the rules, the template, submissions with their preflight, proofs, design service",
    decisions: ["D-070", "D-071", "D-072"],
    response: storeArtwork,
  }),
  "POST /v1/store/orders/{orderId}/artwork/submissions": request({
    request: "store.artwork",
    summary: "Submit uploaded files (or the online design) as a new artwork version; preflight runs on it (D-070)",
    decisions: ["D-070"],
    body: z.object({
      files: z.array(z.object({ fileId: uuid(), role: artworkFileRole })).max(20),
      designDocumentId: uuid().optional(),
      note: z.string().trim().max(2000).optional(),
    }),
    response: storeArtwork,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/orders/{orderId}/proofs/{proofId}/annotations": request({
    request: "store.proofs",
    summary: "The comment threads on one proof, oldest first",
    response: z.object({ data: z.array(storeAnnotationThread) }),
  }),
  "POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations": request({
    request: "store.proofs",
    summary: "Pin or box a spot on a proof page with a comment; prepress answers in the same thread",
    body: z.object({
      page: z.number().int().min(0),
      kind: z.enum(["pin", "rect"]),
      geometry: z.record(z.string(), z.number().min(0).max(1)),
      body: z.string().trim().min(1).max(2000),
    }),
    response: storeAnnotationThread,
    status: 201,
  }),
  "POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations/{annotationId}/messages": request({
    request: "store.proofs",
    summary: "Reply in a comment thread",
    body: z.object({ body: z.string().trim().min(1).max(2000) }),
    response: storeAnnotationThread,
    status: 201,
  }),
  "POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/approve": request({
    request: "store.proofs",
    summary:
      "Approve a proof for production; the API records the evidence (who, when, file hash, checklist) and may start production (D-073)",
    decisions: ["D-073"],
    body: z.object({ checklist: z.array(z.string()).min(1), note: z.string().trim().max(1000).optional() }),
    response: storeArtwork,
    idempotent: true,
  }),
  "POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/request-changes": request({
    request: "store.proofs",
    summary: "Ask for changes to a proof, with what to change; open comment threads go with it",
    body: z.object({ note: z.string().trim().min(3).max(2000) }),
    response: storeArtwork,
  }),
  "PUT /v1/store/orders/{orderId}/design-service/brief": request({
    request: "store.design-service",
    summary: "Answer the hired-design brief (D-071); the designer starts once it is in",
    decisions: ["D-071"],
    body: z.object({
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
      fileIds: z.array(uuid()).max(20),
    }),
    response: storeArtwork,
  }),
  "POST /v1/store/orders/{orderId}/design-service/rounds": request({
    request: "store.design-service",
    summary:
      "Ask for a revision round; from round 4 it is charged (D-071) and the customer accepts the fee, then pays it before work starts",
    decisions: ["D-071"],
    body: z.object({
      note: z.string().trim().min(3).max(2000),
      fileIds: z.array(uuid()).max(10).optional(),
      /** Must restate the fee the API quoted for a chargeable round. */
      acceptedFee: money().optional(),
    }),
    response: storeArtwork,
    status: 201,
    idempotent: true,
  }),
  "POST /v1/store/orders/{orderId}/design-service/actions/approve": request({
    request: "store.design-service",
    summary: "Approve the delivered design; it becomes the artwork that goes to preflight and proof",
    response: storeArtwork,
    idempotent: true,
  }),
} as const;
