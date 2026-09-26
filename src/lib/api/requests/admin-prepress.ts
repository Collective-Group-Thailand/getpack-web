/**
 * Requests for the prepress and design-services workspace (F2 2.4, B4.1, D-070, D-071, D-072).
 *
 * Shapes follow packio-api's approved schema design §3.7: `artwork_submissions` (+ files and
 * `preflight_findings`), `proofs` (+ `proof_annotations`), `dieline_deliveries`, `drawing_jobs`,
 * `design_service_requests` (+ `design_rounds`), mockup jobs and `design_documents`, with the §4
 * enums verbatim. Prepress sees neither factory cost nor margin (D-141), and nothing here carries
 * either; the design fee and a paid round's fee are customer prices, computed by the API.
 *
 * The workspace is one page-shaped aggregate per order, for the same reason the order's is;
 * annotation threads page separately per proof because a busy proof accumulates many.
 */

import { z } from "zod";

import {
  artworkSource,
  artworkStatus,
  customerRef,
  designOption,
  mockupOption,
  preflightFinding,
  preflightStatus,
  productionJobStatus,
  productTypeRef,
  proofStatus,
  urgency,
} from "./admin-orders";
import { dateTime, fileRef, listQuery, money, nextAction, page, request, userRef, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const submissionStatus = z
  .enum(["submitted", "superseded", "accepted_for_proof", "rejected"])
  .meta({ id: "SubmissionStatus" });
export const artworkFileRole = z.enum(["artwork", "font", "link", "reference"]).meta({ id: "ArtworkFileRole" });
export const decisionChannel = z.enum(["web", "line_liff", "cs_on_behalf"]).meta({ id: "DecisionChannel" });
export const annotationKind = z.enum(["pin", "rect", "draw"]).meta({ id: "AnnotationKind" });
export const dielineTrigger = z.enum(["auto_after_payment", "manual"]).meta({ id: "DielineTrigger" });
export const designServiceStatus = z
  .enum(["brief_pending", "in_progress", "delivered", "revision_requested", "approved", "cancelled", "requoted"])
  .meta({ id: "DesignServiceStatus" });
export const designRoundKind = z.enum(["initial", "revision"]).meta({ id: "DesignRoundKind" });
export const designRoundStatus = z
  .enum(["awaiting_payment", "in_progress", "delivered", "approved", "changes_requested"])
  .meta({ id: "DesignRoundStatus" });
export const drawingFormat = z.enum(["svg", "dxf", "pdf"]).meta({ id: "DrawingFormat" });
export const drawingStatus = z
  .enum(["queued", "running", "succeeded", "failed", "engine_unavailable"])
  .meta({ id: "DrawingStatus" });

/**
 * Why an order is on the prepress desk: a preflight to review, a proof to prepare, a proof with
 * the customer, changes the customer asked for, a template to send, design work, a mockup.
 */
export const prepressQueue = z
  .enum(["preflight", "proof", "awaiting_customer", "changes_requested", "template", "design", "mockup"])
  .meta({ id: "PrepressQueue" });

/* ----------------------------------------------------------------------------------- list */

export const prepressItem = z
  .object({
    orderId: uuid(),
    orderCode: z.string(),
    customer: customerRef,
    productType: productTypeRef,
    artworkStatus,
    /** The stage the API files this order under right now. */
    stage: prepressQueue,
    latestSubmission: z.object({ versionNo: z.number().int(), preflightStatus, submittedAt: dateTime() }).nullable(),
    latestProof: z.object({ versionNo: z.number().int(), status: proofStatus, sentAt: dateTime() }).nullable(),
    design: z
      .object({ status: designServiceStatus, roundNo: z.number().int(), freeRounds: z.number().int() })
      .nullable(),
    mockup: z.object({ status: productionJobStatus }).nullable(),
    assignee: userRef().nullable(),
    /** The stage's deadline on the business calendar (D-161), computed by the API. */
    slaDueAt: dateTime().nullable(),
    urgency,
    updatedAt: dateTime(),
  })
  .meta({ id: "PrepressItemDto" });

/* --------------------------------------------------------------------------------- detail */

export const artworkSubmissionDetail = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    source: artworkSource,
    status: submissionStatus,
    preflightStatus,
    preflightCompletedAt: dateTime().nullable(),
    /** Per-check severity comes from settings, defaults per D-070 (block size/bleed, warn resolution/RGB). */
    findings: z.array(preflightFinding.extend({ thumbnailUrl: z.string().nullable() })),
    files: z.array(z.object({ role: artworkFileRole, file: fileRef() })),
    designDocumentId: uuid().nullable(),
    submittedBy: userRef().nullable(),
    submittedAt: dateTime(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "ArtworkSubmissionDetailDto" });

export const proofDetail = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    submissionVersionNo: z.number().int(),
    status: proofStatus,
    proofFile: fileRef(),
    dielineFile: fileRef().nullable(),
    note: z.string().nullable(),
    preparedBy: userRef(),
    sentAt: dateTime(),
    decidedAt: dateTime().nullable(),
    decidedBy: userRef().nullable(),
    decisionChannel: decisionChannel.nullable(),
    onBehalfReason: z.string().nullable(),
    /** The approved file is locked and hashed (B4.1). */
    approvedFileSha256: z.string().nullable(),
    annotations: z.object({ open: z.number().int(), resolved: z.number().int() }),
  })
  .meta({ id: "ProofDetailDto" });

export const designRound = z
  .object({
    roundNo: z.number().int(),
    kind: designRoundKind,
    /** From the fourth round (D-071); the fee and its instalment are the API's. */
    chargeable: z.boolean(),
    feeAmount: money().nullable(),
    status: designRoundStatus,
    requestedAt: dateTime(),
    startedAt: dateTime().nullable(),
    deliveredAt: dateTime().nullable(),
    files: z.array(fileRef()),
    note: z.string().nullable(),
  })
  .meta({ id: "DesignRoundDto" });

export const designService = z
  .object({
    id: uuid(),
    status: designServiceStatus,
    /** The legacy `brd_*` brief, rendered by the API. */
    brief: z.array(z.object({ label: z.string(), value: z.string() })),
    briefFiles: z.array(fileRef()),
    designer: userRef().nullable(),
    targetDueAt: dateTime(),
    maxDueAt: dateTime(),
    /** Snapshot of the setting when the order was placed (3, D-071). */
    freeRounds: z.number().int(),
    designFeeNet: money(),
    rounds: z.array(designRound),
    /** What the next revision would cost the customer, if it is chargeable — the API's figure. */
    nextRound: z.object({ roundNo: z.number().int(), chargeable: z.boolean(), feeAmount: money().nullable() }),
  })
  .meta({ id: "DesignServiceDto" });

/** A design document as the designer stores it (`design_documents` + its current version). */
export const designDocumentView = z
  .object({
    id: uuid(),
    title: z.string(),
    versionNo: z.number().int(),
    schemaVersion: z.number().int(),
    /** The designer's own document (`SavedDesign`'s spec and content); read by the viewer only. */
    document: z.object({ spec: z.record(z.string(), z.unknown()), content: z.record(z.string(), z.unknown()) }),
    thumbnailUrl: z.string().nullable(),
    owner: z.object({ displayName: z.string() }),
    updatedAt: dateTime(),
  })
  .meta({ id: "DesignDocumentViewDto" });

export const drawingJob = z
  .object({
    id: uuid(),
    format: drawingFormat,
    status: drawingStatus,
    outputFile: fileRef().nullable(),
    error: z.string().nullable(),
    engineVersion: z.string().nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "DrawingJobDto" });

export const prepressDetail = z
  .object({
    orderId: uuid(),
    orderCode: z.string(),
    orderStatus: z.string(),
    customer: customerRef,
    productType: productTypeRef,
    quantity: z.number().int(),
    unit: z.string(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    dieline: z.object({
      patternCode: z.string().nullable(),
      lengthMm: z.number().int().nullable(),
      widthMm: z.number().int().nullable(),
      heightMm: z.number().int().nullable(),
    }),
    designOption,
    mockupOption,
    promisedShipDate: z.string().nullable(),
    artworkStatus,
    stage: prepressQueue.nullable(),
    assignee: userRef().nullable(),
    slaDueAt: dateTime().nullable(),
    urgency,
    /** Newest first. */
    submissions: z.array(artworkSubmissionDetail),
    /** Newest first. */
    proofs: z.array(proofDetail),
    templateDeliveries: z.array(
      z.object({
        id: uuid(),
        trigger: dielineTrigger,
        sentAt: dateTime(),
        sentBy: userRef().nullable(),
        file: fileRef(),
      }),
    ),
    drawingJobs: z.array(drawingJob),
    designService: designService.nullable(),
    mockup: z
      .object({
        jobId: uuid(),
        jobNo: z.string(),
        option: mockupOption,
        status: productionJobStatus,
        factory: z.object({ name: z.string() }).nullable(),
        promisedAt: dateTime().nullable(),
      })
      .nullable(),
    designDocument: designDocumentView.nullable(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "PrepressDetailDto" });

export const proofAnnotation = z
  .object({
    id: uuid(),
    parentId: uuid().nullable(),
    page: z.number().int(),
    kind: annotationKind,
    /** Page-relative 0–1 coordinates: `{ x, y }` for a pin, `{ x, y, w, h }` for a rect, `{ points }` for a drawing. */
    geometry: z.record(z.string(), z.unknown()),
    comment: z.string(),
    author: userRef(),
    authorKind: z.enum(["customer", "staff"]).meta({ id: "AnnotationAuthorKind" }),
    createdAt: dateTime(),
    resolvedAt: dateTime().nullable(),
    resolvedBy: userRef().nullable(),
  })
  .meta({ id: "ProofAnnotationDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminPrepressRequests = {
  "GET /v1/admin/prepress": request({
    request: "admin.prepress",
    summary: "The prepress desk: orders by stage, each with the stage's SLA",
    decisions: ["D-070", "D-071", "D-072"],
    query: listQuery({
      queue: prepressQueue.optional(),
      artworkStatus: artworkStatus.optional(),
      productType: z.string().optional(),
      assigneeId: uuid().optional(),
    }),
    response: page(prepressItem),
  }),
  "GET /v1/admin/prepress/{orderId}": request({
    request: "admin.prepress",
    summary: "One order's prepress workspace: submissions and preflight, proofs, template, design service, mockup",
    response: prepressDetail,
  }),
  "POST /v1/admin/prepress/{orderId}/actions/assign": request({
    request: "admin.prepress-actions",
    summary: "Put a prepress artist on the order, or take them off (null)",
    body: z.object({ assigneeId: uuid().nullable() }),
    response: prepressDetail,
  }),
  "POST /v1/admin/prepress/submissions/{submissionId}/actions/accept": request({
    request: "admin.prepress-actions",
    summary: "Accept a submission for proofing; warnings are acknowledged, a blocking finding cannot be (D-070)",
    decisions: ["D-070"],
    body: z.object({ note: z.string().max(1000).optional() }),
    response: prepressDetail,
  }),
  "POST /v1/admin/prepress/submissions/{submissionId}/actions/reject": request({
    request: "admin.prepress-actions",
    summary: "Send a submission back; the customer is asked to upload again with the reason",
    body: z.object({ reason: z.string().min(3).max(1000) }),
    response: prepressDetail,
  }),
  "POST /v1/admin/prepress/{orderId}/proofs": request({
    request: "admin.prepress-proofs",
    summary:
      "Upload a proof version (PDF and optional dieline) and send it to the customer; the previous version is superseded",
    body: z.object({
      submissionId: uuid(),
      proofFileId: uuid(),
      dielineFileId: uuid().optional(),
      note: z.string().max(2000).optional(),
    }),
    response: prepressDetail,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/admin/prepress/proofs/{proofId}/annotations": request({
    request: "admin.prepress-proofs",
    summary: "A proof's annotation threads, oldest first; replies carry `parentId`",
    response: z.object({ data: z.array(proofAnnotation) }),
  }),
  "POST /v1/admin/prepress/proofs/{proofId}/annotations": request({
    request: "admin.prepress-proofs",
    summary: "Reply to a customer's annotation",
    body: z.object({ parentId: uuid(), comment: z.string().min(1).max(2000) }),
    response: proofAnnotation,
    status: 201,
  }),
  "POST /v1/admin/prepress/proofs/{proofId}/annotations/{annotationId}/actions/resolve": request({
    request: "admin.prepress-proofs",
    summary: "Mark a thread resolved (the next version addresses it)",
    response: proofAnnotation,
  }),
  "POST /v1/admin/prepress/{orderId}/drawing-jobs": request({
    request: "admin.prepress-template",
    summary:
      "Draw the dieline for the order's pattern and size with @packio/dieline; 501 drawing.engine_unavailable until the engine is deployed",
    body: z.object({ format: drawingFormat }),
    response: drawingJob,
    status: 202,
  }),
  "POST /v1/admin/prepress/{orderId}/actions/send-template": request({
    request: "admin.prepress-template",
    summary: "Send the template (dieline) to the customer — the manual counterpart of the automatic send after payment",
    body: z.object({
      drawingJobId: uuid().optional(),
      fileId: uuid().optional(),
      message: z.string().max(2000).optional(),
    }),
    response: prepressDetail,
    idempotent: true,
  }),
  "POST /v1/admin/prepress/{orderId}/design/actions/deliver-round": request({
    request: "admin.design-services",
    summary: "Deliver the current design round's files to the customer for approval or changes",
    decisions: ["D-071"],
    body: z.object({ fileIds: z.array(uuid()).min(1).max(10), note: z.string().max(2000).optional() }),
    response: prepressDetail,
    idempotent: true,
  }),
  "POST /v1/admin/prepress/{orderId}/design/actions/requote": request({
    request: "admin.design-services",
    summary: "A change to the structure or the concept is a new design, re-quoted — not a revision (D-071)",
    decisions: ["D-071"],
    body: z.object({ reason: z.string().min(3).max(1000) }),
    response: prepressDetail,
    idempotent: true,
  }),
  "POST /v1/admin/design-documents/{documentId}/actions/copy": request({
    request: "admin.design-documents",
    summary: "Copy a customer's design for prepress to work on; the customer's own document is never changed",
    body: z.object({ title: z.string().min(1).max(200) }),
    response: designDocumentView,
    status: 201,
  }),
} as const;
