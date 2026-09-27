/**
 * The partner zone's production floor (F5 5.2): Today, jobs, milestones, QC, issues and the
 * capacity calendar. packio-api B4.2 names this surface — "today counters, job list/detail (spec,
 * approved proof & dieline — signed URLs, approved version only), accept/reject, milestone
 * start/complete (Idempotency-Key, quantity validation, client id + timestamp; server wins on
 * conflict), evidence upload, QC, issues, capacity maintenance" — and has not published it.
 *
 * Shapes follow schema-design §3.7: `production_jobs`, `job_milestones` (`client_ref`,
 * `client_reported_at`, quantities in/out/scrap), `qc_checks`, `job_issues`, `inspections`, and
 * the D-142 rule that a factory sees only the recipient's name, address and phone. Every mutation
 * carries `clientRef` + `clientReportedAt` and an `Idempotency-Key`; a conflicting update is a
 * `409` and the screen shows the server's state.
 */

import { z } from "zod";

import { milestoneStatus, productTypeRef, productionJobStatus } from "./admin-orders";
import { date, dateTime, fileRef, listQuery, money, page, pct, request, userRef, uuid } from "./define";

/* ------------------------------------------------------------------------------ shared */

/** The shop floor's filter tabs: รอรับงาน · กำลังผลิต · รอ QC · พร้อมส่ง · ล่าช้า (F5 5.2). */
export const jobView = z
  .enum(["to_accept", "in_production", "awaiting_qc", "ready_to_ship", "late", "all"])
  .meta({ id: "PartnerJobView" });

export const rejectReason = z
  .enum(["capacity", "material", "machine", "spec_not_feasible", "price", "other"])
  .meta({ id: "JobRejectReason" });

export const qcResult = z.enum(["pass", "fail", "conditional"]).meta({ id: "QcResult" });
export const issueKind = z
  .enum(["material", "machine", "artwork", "quantity", "quality", "delay", "other"])
  .meta({ id: "JobIssueKind" });
export const issueStatus = z.enum(["open", "resolved"]).meta({ id: "JobIssueStatus" });

/** The device's identity for one report and when it was made there (schema-design `client_ref`). */
const clientStamp = {
  clientRef: uuid(),
  clientReportedAt: dateTime(),
};

export const partnerMilestone = z
  .object({
    seq: z.number().int(),
    key: z.string(),
    name: z.string(),
    status: milestoneStatus,
    dueAt: dateTime().nullable(),
    startedAt: dateTime().nullable(),
    completedAt: dateTime().nullable(),
    /** The route's evidence rule for this step (B4.2): a photo, a QC form. */
    requiresPhoto: z.boolean(),
    requiresQc: z.boolean(),
    quantityIn: z.number().int().nullable(),
    quantityOut: z.number().int().nullable(),
    quantityScrap: z.number().int().nullable(),
    photos: z.array(fileRef()),
    note: z.string().nullable(),
    reportedBy: userRef().nullable(),
    onTime: z.boolean().nullable(),
  })
  .meta({ id: "PartnerJobMilestoneDto" });

export const partnerJobSummary = z
  .object({
    id: uuid(),
    jobNo: z.string(),
    kind: z.enum(["production", "mockup", "reproduction"]),
    status: productionJobStatus,
    productType: productTypeRef,
    title: z.string(),
    quantity: z.number().int(),
    /** Accept or reject by this time (D-074: 1 business day, computed by the API). */
    acceptDueAt: dateTime().nullable(),
    promisedShipDate: date(),
    atRisk: z.boolean(),
    riskReason: z.string().nullable(),
    current: partnerMilestone.pick({ seq: true, key: true, name: true, status: true, dueAt: true }).nullable(),
    /** Packio inspects this job before it ships (D-076). */
    inspectionRequired: z.boolean(),
    views: z.array(jobView),
  })
  .meta({ id: "PartnerJobSummaryDto" });

export const partnerDestination = z
  .object({
    id: uuid(),
    /** D-142: the recipient's name, delivery address and phone — nothing else about the customer. */
    recipientName: z.string(),
    phone: z.string(),
    address: z.string(),
    province: z.string(),
    postcode: z.string(),
    quantity: z.number().int(),
    /** What is already on a shipment for this destination. */
    shippedQuantity: z.number().int(),
  })
  .meta({ id: "PartnerDestinationDto" });

export const qcCheck = z
  .object({
    id: uuid(),
    result: qcResult,
    isFirstPass: z.boolean(),
    checklist: z.array(
      z.object({ key: z.string(), label: z.string(), pass: z.boolean(), note: z.string().nullable() }),
    ),
    defects: z.array(z.object({ label: z.string(), count: z.number().int() })),
    photos: z.array(fileRef()),
    notes: z.string().nullable(),
    performedBy: userRef(),
    performedAt: dateTime(),
  })
  .meta({ id: "PartnerQcCheckDto" });

export const jobIssue = z
  .object({
    id: uuid(),
    kind: issueKind,
    description: z.string(),
    status: issueStatus,
    photos: z.array(fileRef()),
    raisedBy: userRef(),
    raisedAt: dateTime(),
    resolvedAt: dateTime().nullable(),
  })
  .meta({ id: "PartnerJobIssueDto" });

export const partnerJob = partnerJobSummary
  .extend({
    /** The spec snapshot at release, as lines a person reads (the API localises them). */
    spec: z.array(z.object({ label: z.string(), value: z.string() })),
    /** The approved proof and dieline only — never a draft (B4.2), as short-lived signed URLs. */
    artwork: z
      .object({ versionNo: z.number().int(), approvedAt: dateTime(), proof: fileRef(), dieline: fileRef().nullable() })
      .nullable(),
    purchaseOrder: z.object({
      poNumber: z.string(),
      issuedAt: dateTime(),
      buyAmount: money(),
      currency: z.literal("THB"),
    }),
    tolerance: z.object({ shortagePct: pct(), overagePct: pct() }),
    destinations: z.array(partnerDestination),
    milestones: z.array(partnerMilestone),
    /** The QC form this job's route asks for (D-076), and what was recorded against it. */
    qcChecklist: z.array(z.object({ key: z.string(), label: z.string() })),
    qcChecks: z.array(qcCheck),
    /** Packio's own inspection, when sampling selected the job (D-076). */
    inspections: z.array(
      z.object({
        id: uuid(),
        status: z.enum(["planned", "in_progress", "passed", "failed", "waived"]),
        reasons: z.array(z.string()),
        plannedFor: date().nullable(),
        resultAt: dateTime().nullable(),
        notes: z.string().nullable(),
      }),
    ),
    issues: z.array(jobIssue),
    history: z.array(z.object({ at: dateTime(), text: z.string(), actor: userRef().nullable() })),
    /** What the factory may do next (api-conventions `nextActions`). */
    nextActions: z.array(
      z.enum(["accept", "reject", "start_milestone", "complete_milestone", "record_qc", "raise_issue", "ship"]),
    ),
    rejectedReason: rejectReason.nullable(),
  })
  .meta({ id: "PartnerJobDto" });

/* ------------------------------------------------------------------------------- today */

export const partnerToday = z
  .object({
    counters: z.object({
      toAccept: z.number().int(),
      dueToday: z.number().int(),
      atRisk: z.number().int(),
      onHold: z.number().int(),
    }),
    /** Jobs in the order the floor should look at them: accept first, then due soonest. */
    queue: z.array(partnerJobSummary),
    alerts: z.array(
      z.object({
        kind: z.enum(["accept_overdue", "accept_due_soon", "milestone_overdue", "inspection_planned", "on_hold"]),
        jobId: uuid(),
        jobNo: z.string(),
        text: z.string(),
        at: dateTime().nullable(),
      }),
    ),
  })
  .meta({ id: "PartnerTodayDto" });

/* --------------------------------------------------------------------- capacity calendar */

export const capacityCalendar = z
  .object({
    weeks: z.array(
      z.object({
        weekStart: date(),
        types: z.array(
          z.object({
            productTypeId: uuid(),
            productType: productTypeRef,
            unit: z.enum(["pieces", "sheets", "sqm", "jobs"]),
            capacity: z.string(),
            booked: z.string(),
            free: z.string(),
          }),
        ),
      }),
    ),
    /** Days the factory does not work: the national calendar's non-working days and its own (D-161). */
    closures: z.array(z.object({ date: date(), name: z.string(), kind: z.enum(["national", "factory"]) })),
  })
  .meta({ id: "PartnerCapacityCalendarDto" });

/* ------------------------------------------------------------------------------- group */

const path = "/v1/partner/factories/{factoryId}";

export const partnerJobRequests = {
  [`GET ${path}/today` as const]: request({
    request: "partner.today",
    summary: "Counters, the queue and alerts for my factory's shop floor today",
    decisions: ["D-074", "D-075"],
    response: partnerToday,
  }),
  [`GET ${path}/jobs` as const]: request({
    request: "partner.jobs",
    summary: "My factory's jobs by view (to accept, in production, awaiting QC, ready to ship, late)",
    decisions: ["D-074", "D-142"],
    query: listQuery({ view: jobView.optional() }),
    response: page(partnerJobSummary),
  }),
  [`GET ${path}/jobs/lookup` as const]: request({
    request: "partner.jobs",
    summary: "The job a scanned code or a typed job number points to (job traveller, carton label)",
    query: z.object({ code: z.string().min(3).max(200) }),
    response: z.object({ jobId: uuid(), jobNo: z.string() }),
  }),
  [`GET ${path}/jobs/{jobId}` as const]: request({
    request: "partner.jobs",
    summary: "One job: spec, approved artwork only, PO, recipients (D-142), milestones, QC, inspections, issues",
    decisions: ["D-074", "D-076", "D-142"],
    response: partnerJob,
  }),
  [`POST ${path}/jobs/{jobId}/actions/accept` as const]: request({
    request: "partner.jobs",
    summary: "Accept a released job within its acceptance window (D-074)",
    decisions: ["D-074", "D-022"],
    body: z.object(clientStamp),
    response: partnerJob,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/actions/reject` as const]: request({
    request: "partner.jobs",
    summary: "Reject a released job with a reason; Packio reassigns or escalates (D-012, D-101)",
    decisions: ["D-012", "D-074", "D-101"],
    body: z.object({ ...clientStamp, reason: rejectReason, note: z.string().trim().max(1000).optional() }),
    response: partnerJob,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/milestones/{seq}/actions/start` as const]: request({
    request: "partner.job-milestones",
    summary: "Start a milestone (the previous one complete); server wins on a conflicting report",
    decisions: ["D-075"],
    body: z.object(clientStamp),
    response: partnerJob,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/milestones/{seq}/actions/complete` as const]: request({
    request: "partner.job-milestones",
    summary: "Complete a milestone with quantities in/out/scrap and its photos; validated by the API",
    decisions: ["D-075", "D-021"],
    body: z.object({
      ...clientStamp,
      quantityIn: z.number().int().min(0),
      quantityOut: z.number().int().min(0),
      quantityScrap: z.number().int().min(0),
      photoFileIds: z.array(uuid()).max(20),
      note: z.string().trim().max(1000).optional(),
    }),
    response: partnerJob,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/qc-checks` as const]: request({
    request: "partner.job-qc",
    summary: "Record the factory's QC against the route's checklist, with photos (D-076)",
    decisions: ["D-076"],
    body: z.object({
      ...clientStamp,
      checklist: z.array(z.object({ key: z.string(), pass: z.boolean(), note: z.string().max(500).optional() })).min(1),
      result: qcResult,
      defects: z.array(z.object({ label: z.string().min(1).max(200), count: z.number().int().min(1) })).max(20),
      photoFileIds: z.array(uuid()).min(1).max(20),
      notes: z.string().trim().max(1000).optional(),
    }),
    response: partnerJob,
    status: 201,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/issues` as const]: request({
    request: "partner.job-issues",
    summary: "Raise an issue on a job (material, machine, artwork…); Packio sees it on the board",
    body: z.object({
      ...clientStamp,
      kind: issueKind,
      description: z.string().trim().min(3).max(2000),
      photoFileIds: z.array(uuid()).max(10).optional(),
    }),
    response: partnerJob,
    status: 201,
    idempotent: true,
  }),
  [`POST ${path}/jobs/{jobId}/issues/{issueId}/actions/resolve` as const]: request({
    request: "partner.job-issues",
    summary: "Mark one of my factory's issues resolved",
    body: z.object({ ...clientStamp, note: z.string().trim().max(1000).optional() }),
    response: partnerJob,
    idempotent: true,
  }),
  [`GET ${path}/capacity-calendar` as const]: request({
    request: "partner.capacity-calendar",
    summary: "Weekly capacity per product type against booked load, with closures (D-101, D-161)",
    decisions: ["D-101", "D-161"],
    query: z.object({ from: date().optional(), weeks: z.coerce.number().int().min(1).max(26).optional() }),
    response: capacityCalendar,
  }),
} as const;
