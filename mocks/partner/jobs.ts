/**
 * The factory's production floor on the published contract (U-F0.4): `partner.production.*`
 * (today, list by view, lookup, get, accept, reject, milestone updates, QC, issues),
 * `partner.factories.capacityCalendar` and the factory's purchase orders — over **the commerce
 * mock's own orders and jobs**, so what the factory accepts, starts and completes here is what the
 * back office's order screen and production board show (`../admin/production.ts`).
 *
 * Jobs are token-scoped (`/v1/partner/production-jobs`): the signed-in user's factory only, and
 * another factory's job is a 404 (D-044). Every write the contract declares an `Idempotency-Key`
 * on is replayed by key (`once`).
 *
 * At start, two of the launch factory's in-production jobs are put back to `released` — jobs
 * waiting for acceptance, one due within hours (D-074) — and the second's order is split across
 * two delivery addresses (D-110), so a flow can accept, produce and ship to both.
 *
 * Rules mirrored from packio-api (`milestones.service.ts` at v0.6.0): milestones in route order;
 * a repeated `clientRef`, or a step another device already moved, answers `applied: false` with
 * the current job (server wins); out + scrap of a tracked step never exceed what came in; photos
 * and a passing QC form where the step's evidence asks for them; QC needs a photo.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { orders, type MockOrder } from "../admin/commerce";
import { partnerJobActions } from "../admin/floor-actions";
import { inspections } from "../admin/governance";
import { PRODUCT_TYPES } from "../admin/catalog";
import { stores } from "../admin/partners";
import { fileDataUrl, files } from "../admin/platform";
import { partnerPersonaOf } from "../auth";
import { provinceRefOf } from "../store/catalog";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { permissionsOf, type PartnerPersona } from "./personas";
import { once, own, type Own } from "./support";

type Job = MockOrder["jobs"][number];
type JobDto = Schemas["PartnerJobDto"];
type Milestone = Schemas["MilestoneDto"];
type QcCheck = Schemas["QcCheckDto"];
type Issue = Schemas["JobIssueDto"];
type UserRef = Schemas["UserRefDto"];

const DAY = 24 * 60;
const HOUR = 60;
const now = () => bangkokIso();

/** The route every mock job follows (B4.2: editable data per product type in the API). */
export const ROUTE = [
  { key: "step_1", nameTh: "รับงาน", nameEn: "Accept", evidence: "none", tracksQuantity: false },
  { key: "step_2", nameTh: "เตรียมวัตถุดิบ", nameEn: "Materials", evidence: "none", tracksQuantity: false },
  { key: "step_3", nameTh: "พิมพ์", nameEn: "Printing", evidence: "photo", tracksQuantity: true },
  { key: "step_4", nameTh: "ไดคัท", nameEn: "Die-cutting", evidence: "photo", tracksQuantity: true },
  { key: "step_5", nameTh: "ตรวจคุณภาพ", nameEn: "Quality check", evidence: "qc_form", tracksQuantity: true },
  { key: "step_6", nameTh: "แพ็ก", nameEn: "Packing", evidence: "photo", tracksQuantity: true },
] as const satisfies readonly {
  key: string;
  nameTh: string;
  nameEn: string;
  evidence: Schemas["EvidenceRequirement"];
  tracksQuantity: boolean;
}[];

interface StepExtra {
  startedAt: string | null;
  quantityIn: number | null;
  quantityOut: number | null;
  quantityScrap: number | null;
  photoIds: string[];
  note: string | null;
  reportedBy: UserRef | null;
  clientRef: string | null;
}

/** What the floor reports about a job beyond the commerce row (a mock-only model). */
interface Extra {
  steps: Map<number, StepExtra>;
  qcChecks: QcCheck[];
  issues: Issue[];
  /** The job's activity, newest last; the billing mock reads when it was accepted from it. */
  history: { at: string; text: string; actor: UserRef | null }[];
  rejected: { reasonCode: Schemas["JobRejectReason"]; note: string | null; at: string } | null;
  releasedAt: string;
  acceptedAt: string | null;
}

const extras = new Map<string, Extra>();

const blankStep = (): StepExtra => ({
  startedAt: null,
  quantityIn: null,
  quantityOut: null,
  quantityScrap: null,
  photoIds: [],
  note: null,
  reportedBy: null,
  clientRef: null,
});

/** The launch factory's production jobs, with the order each belongs to. */
export function factoryJobs(factoryId: string): { order: MockOrder; job: Job }[] {
  return orders.flatMap((order) =>
    order.jobs
      .filter((job) => job.factory?.id === factoryId && job.kind === "production")
      .map((job) => ({ order, job })),
  );
}

export function extraOf(job: Job): Extra {
  let extra = extras.get(job.id);
  if (!extra) {
    extra = {
      steps: new Map(),
      qcChecks: [],
      issues: [],
      history: [],
      rejected: null,
      releasedAt: bangkokIso(-DAY),
      acceptedAt: job.status === "released" ? null : bangkokIso(-DAY),
    };
    extras.set(job.id, extra);
  }
  return extra;
}

/* ------------------------------------------------------------------------------ seeding */

function seed() {
  const F001 = "00000000-0000-4000-8000-0000000000f1";
  const jobs = factoryJobs(F001);
  // Completed tracked steps of a seeded job carry quantities, so a report on the next step is checked.
  for (const { order, job } of jobs) {
    const extra = extraOf(job);
    // Released (and accepted) a while back, so their advances have been paid (D-022).
    extra.releasedAt = bangkokIso(-DAY * (job.status === "completed" ? 30 : 7));
    extra.acceptedAt = bangkokIso(-DAY * (job.status === "completed" ? 30 : 7) + HOUR * 3);
    let quantity = Math.round(order.quantity * 1.04);
    job.milestones.forEach((milestone) => {
      const step = blankStep();
      if (milestone.status !== "pending") step.startedAt = bangkokIso(-DAY * (7 - milestone.seq));
      if (milestone.status === "completed" && ROUTE[milestone.seq - 1]?.tracksQuantity) {
        const scrap = Math.round(quantity * 0.01);
        Object.assign(step, { quantityIn: quantity, quantityScrap: scrap, quantityOut: quantity - scrap });
        quantity -= scrap;
      }
      extra.steps.set(milestone.seq, step);
    });
  }
  // Two jobs wait for acceptance (D-074): one due tomorrow from the calm end of the seeds, and
  // one due within hours whose order is paid up and not held for an inspection — the one a flow
  // can take all the way to delivery, split across two addresses.
  const open = (jobId: string) =>
    inspections.some((item) => item.job.id === jobId && ["planned", "in_progress", "failed"].includes(item.status));
  const paidUp = (order: MockOrder) =>
    !order.instalments.some((item) => item.requiredBefore === "shipping" && item.status !== "paid");
  const calm = jobs.filter(({ order, job }) => job.status === "in_progress" && order.urgency === "normal").at(-1);
  const shippable = jobs.find(({ order, job }) => job.status === "in_progress" && paidUp(order) && !open(job.id));
  [calm, shippable]
    .filter((item): item is NonNullable<typeof item> => !!item)
    .forEach(({ order, job }, index) => {
      Object.assign(job, {
        status: "released",
        acceptDueAt: bangkokIso(index === 0 ? HOUR * 20 : HOUR * 3),
        atRisk: false,
        milestones: [],
      });
      const extra = extraOf(job);
      extra.steps.clear();
      extra.acceptedAt = null;
      extra.releasedAt = bangkokIso(index === 0 ? -HOUR * 4 : -HOUR * 21);
      extra.history = [{ at: extra.releasedAt, text: "Packio ส่งงานให้โรงงาน", actor: null }];
      if (index === 1 && order.destinations.length === 1) {
        // Split across two addresses (D-110): head office and a branch.
        const [first] = order.destinations;
        const half = Math.floor(first!.quantity / 2);
        order.destinations = [
          { ...first!, quantity: first!.quantity - half },
          {
            ...first!,
            id: mockId("dst", 700),
            recipientName: `${first!.recipientName} (สาขา)`,
            line1: "88 ถนนสาขาตัวอย่าง (ข้อมูลจำลอง)",
            quantity: half,
          },
        ];
      }
    });
}
seed();

/* ------------------------------------------------------------------------------- views */

/** The buy side of an order (the factory's own price, D-042) — never Packio's sell price. */
export const buyAmountOf = (order: MockOrder) => (Math.round(Number(order.netAmount) * 70) / 100).toFixed(2);

/** "กล่องฝาเสียบ (RSC)" — the product type, and the first spec line where it adds something. */
export const titleOf = (order: MockOrder) => {
  const first = order.specs[0]?.value;
  return first && first !== order.productType.name ? `${order.productType.name} ${first}` : order.productType.name;
};

/** A milestone's id: stable per job and step, the same one the back office's job carries. */
export const milestoneIdOf = (job: Pick<Job, "id">, seq: number) =>
  mockId("mls", (Number.parseInt(job.id.slice(-6), 16) % 0x1000) * 16 + seq);

/** The job's steps as `MilestoneDto`: the commerce row's status and dates, the floor's reports. */
export function milestonesOf(job: Job): Milestone[] {
  const extra = extraOf(job);
  return job.milestones.map((milestone) => {
    const step = extra.steps.get(milestone.seq) ?? blankStep();
    const route = ROUTE[milestone.seq - 1] ?? ROUTE[0];
    return {
      id: milestoneIdOf(job, milestone.seq),
      seq: milestone.seq,
      key: milestone.key,
      nameTh: route.nameTh,
      nameEn: route.nameEn,
      status: milestone.status,
      dueAt: milestone.dueAt,
      startedAt: step.startedAt,
      completedAt: milestone.completedAt,
      onTime: milestone.onTime,
      customerVisible: true,
      evidence: route.evidence,
      tracksQuantity: route.tracksQuantity,
      quantityIn: step.quantityIn,
      quantityOut: step.quantityOut,
      quantityScrap: step.quantityScrap,
      photoFileIds: [...step.photoIds],
      note: step.note,
    };
  });
}

/** What each destination already has on a live shipment (the shipments mock answers it). */
export type ShippedCounter = (order: MockOrder, destinationId: string) => number;
let shippedOf: ShippedCounter = () => 0;
export const setShippedCounter = (counter: ShippedCounter) => {
  shippedOf = counter;
};

/** A carton label code → the job it carries (the shipments mock answers it, for the scanner). */
let cartonJob: (code: string) => string | null = () => null;
export const setCartonLookup = (lookup: (code: string) => string | null) => {
  cartonJob = lookup;
};

/** D-142: the recipient's name, delivery address and phone — nothing else about the customer. */
export function destinationsOf(order: MockOrder): Schemas["JobDestinationDto"][] {
  return order.destinations.map((destination) => {
    const province = provinceRefOf(destination.postcode, destination.province);
    return {
      id: destination.id,
      recipientName: destination.recipientName,
      phone: destination.phone,
      line1: [destination.line1, destination.subdistrict, destination.district].filter(Boolean).join(" "),
      line2: destination.line2,
      provinceNameTh: province.nameTh,
      provinceNameEn: province.nameEn,
      postcode: destination.postcode,
      quantity: destination.quantity,
      shippedQuantity: shippedOf(order, destination.id),
    };
  });
}

export const jobDone = (job: Job) =>
  job.status === "completed" || (job.milestones.length > 0 && job.milestones.every((m) => m.status === "completed"));

const current = (job: Job) => job.milestones.find((m) => m.status !== "completed" && m.status !== "skipped");

/** The step overdue, or the plan past the promise (D-075) — only while the job is predicted late. */
function riskOf(job: Job): Schemas["JobRiskReason"] | null {
  if (!job.atRisk) return null;
  const step = current(job);
  return step?.dueAt && Date.parse(step.dueAt) < Date.now() ? "step_overdue" : "late_plan";
}

/** The good pieces the last tracked step put out, and the scrap of every tracked step. */
export function quantitiesOf(job: Job): { good: number | null; scrap: number | null } {
  const tracked = [...extraOf(job).steps.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([seq, step]) => ROUTE[seq - 1]?.tracksQuantity && step.quantityOut !== null)
    .map(([, step]) => step);
  if (tracked.length === 0) return { good: null, scrap: null };
  return {
    good: tracked.at(-1)!.quantityOut,
    scrap: tracked.reduce((total, step) => total + (step.quantityScrap ?? 0), 0),
  };
}

/** Packio's inspection of the job, as far as the factory sees it (D-076). */
export function inspectionOf(job: Pick<Job, "id">): Schemas["JobInspectionDto"] | null {
  const found = inspections.find((item) => item.job.id === job.id);
  return found
    ? { status: found.status, sampleSize: found.sampleSize, scheduledAt: found.scheduledAt, resultAt: found.resultAt }
    : null;
}

/** The approved proof the job prints (approved version only, B4.2). */
export const approvedProofOf = (order: MockOrder) => order.artwork.proofs.find((proof) => proof.status === "approved");

/** The parts of a job both surfaces read the same way (`PartnerJobDto` and `AdminJobDto` share them). */
export function jobCore(order: MockOrder, job: Job) {
  const extra = extraOf(job);
  const proof = approvedProofOf(order);
  const { good, scrap } = quantitiesOf(job);
  const step = current(job);
  return {
    id: job.id,
    jobNo: job.jobNo,
    kind: job.kind,
    status: job.status,
    productTypeCode: order.productType.code,
    productTypeNameTh: order.productType.name,
    title: `${titleOf(order)} · ${order.quantity.toLocaleString("th-TH")} ชิ้น`,
    // A snapshot of what to make, without the selling price (the order's spec lines).
    spec: Object.fromEntries(order.specs.map((line) => [line.label, line.value])),
    tolerance: { ...order.tolerance },
    artwork: proof
      ? { proofId: proof.id, versionNo: proof.versionNo, approvedAt: proof.decidedAt ?? proof.sentAt }
      : null,
    approvedFileId: proof?.file.id ?? null,
    dielineFileId: null,
    inspection: inspectionOf(job),
    inspectionRequired: Number(order.grossAmount) >= 100_000,
    currentMilestoneKey: step?.key ?? null,
    atRisk: job.atRisk,
    riskReason: riskOf(job),
    releasedAt: extra.releasedAt,
    acceptDueAt: job.acceptDueAt ?? bangkokIso(DAY),
    acceptedAt: extra.acceptedAt,
    rejectedAt: extra.rejected?.at ?? null,
    rejectReasonCode: extra.rejected?.reasonCode ?? null,
    rejectNote: extra.rejected?.note ?? null,
    holdReason: null,
    promisedShipDate: job.promisedShipDate ?? order.promisedShipDate,
    plannedStartOn: null,
    plannedFinishOn: job.promisedShipDate ?? order.promisedShipDate,
    quantityOrdered: order.quantity,
    quantityGood: good,
    quantityScrap: scrap,
    lotNo: null,
    destinations: destinationsOf(order),
    milestones: milestonesOf(job),
  } satisfies Partial<JobDto>;
}

export function toPartnerJobDto(order: MockOrder, job: Job, who: PartnerPersona): JobDto {
  return {
    ...jobCore(order, job),
    nextActions: partnerJobActions({ status: job.status, jobKind: job.kind }, new Set(permissionsOf(who))),
  };
}

/* ----------------------------------------------------------------------------- helpers */

/** The signed-in factory user on their own factory (the token's scope, D-044). */
export function mine(request: Request, permission?: string): Response | Own {
  return own(request, partnerPersonaOf(request)?.factoryId, permission);
}

function jobFor(request: Request, jobId: unknown, permission: string) {
  const ok = mine(request, permission);
  if (ok instanceof Response) return ok;
  const found = factoryJobs(ok.store.factory.id).find(({ job }) => job.id === jobId);
  // Another factory's job is not found (D-044), exactly like a job that does not exist.
  if (!found) return problem(404, "http.not_found", "ไม่พบงานนี้");
  return { ...ok, ...found, extra: extraOf(found.job) };
}

const who = (persona: { id: string; displayName: string }): UserRef => ({
  id: persona.id,
  displayName: persona.displayName,
});
const invalid = (path: string, message: string, detail = "ข้อมูลไม่ถูกต้อง") =>
  problem(422, "validation.failed", detail, [{ path, code: "invalid", message }]);
const notWorking = (job: Job) =>
  problem(409, "production.invalid_status", `งานนี้อยู่ในสถานะ ${job.status} ทำรายการนี้ไม่ได้`);

const photosExist = (ids: readonly string[]) => ids.every((id) => files.has(id));

function log(extra: Extra, text: string, actor: UserRef | null) {
  extra.history.push({ at: now(), text, actor });
}

/** Spreads a route's due dates from now to the promised ship date. */
function routeFor(job: Job, order: MockOrder): Job["milestones"] {
  const end = Date.parse(
    `${job.promisedShipDate ?? order.promisedShipDate ?? bangkokIso(DAY * 10).slice(0, 10)}T17:00:00+07:00`,
  );
  const start = Date.now();
  const span = Math.max(end - start, DAY * 60_000);
  return ROUTE.map((step, index) => ({
    seq: index + 1,
    key: step.key,
    name: step.nameTh,
    status: index === 0 ? "completed" : "pending",
    dueAt: bangkokIso(Math.round((span * (index + 1)) / ROUTE.length / 60_000)),
    completedAt: index === 0 ? now() : null,
    onTime: index === 0 ? true : null,
  }));
}

const WORKING = ["accepted", "in_progress"];
const JOB_VIEWS = new Set<string>([
  "to_accept",
  "in_production",
  "ready_to_ship",
  "late",
] satisfies Schemas["JobView"][]);
const ISSUE_KINDS = new Set<string>([
  "material_shortage",
  "machine_down",
  "artwork_question",
  "quantity",
  "quality",
  "delay",
  "other",
] satisfies Schemas["JobIssueKind"][]);
const REJECT_REASONS = new Set<string>([
  "capacity",
  "spec_not_feasible",
  "material_unavailable",
  "artwork_issue",
  "price",
  "other",
] satisfies Schemas["JobRejectReason"][]);

/** `?view=` (D-074): to accept, in production, ready to ship (something left to send), late. */
function inView(order: MockOrder, job: Job, view: string): boolean {
  const remaining = destinationsOf(order).some((item) => item.shippedQuantity < item.quantity);
  const late =
    job.atRisk || (job.status === "released" && !!job.acceptDueAt && Date.parse(job.acceptDueAt) < Date.now());
  switch (view) {
    case "to_accept":
      return job.status === "released";
    case "in_production":
      return ["accepted", "in_progress", "on_hold"].includes(job.status) && !jobDone(job);
    case "ready_to_ship":
      return jobDone(job) && remaining;
    case "late":
      return late && !jobDone(job) && !["rejected", "cancelled"].includes(job.status);
    default:
      return true;
  }
}

/** The floor's order: acceptance first, then the predicted-late, then the soonest due. */
function dueOf(order: MockOrder, job: Job): string {
  return (
    (job.status === "released" ? job.acceptDueAt : null) ??
    current(job)?.dueAt ??
    `${job.promisedShipDate ?? order.promisedShipDate ?? "9999-12-31"}T23:59:59+07:00`
  );
}
const rank = (job: Job) => (job.status === "released" ? 0 : job.atRisk ? 1 : 2);

/* -------------------------------------------------------------------------------- handlers */

const perm = {
  read: "factory_jobs.read",
  respond: "factory_jobs.respond",
  update: "factory_milestones.update",
  qc: "factory_qc.record",
  issues: "factory_issues.raise",
  capacity: "factory_capacity.read",
  payables: "factory_payables.read",
};

export const jobHandlers = [
  // partner.production.today: counters, the queue in the order to work it, and alerts (D-074, D-076).
  http.get("*/v1/partner/factories/:factoryId/today", ({ request, params }) => {
    const ok = own(request, params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const all = factoryJobs(ok.store.factory.id).filter(({ job }) => !["rejected", "cancelled"].includes(job.status));
    const today = bangkokIso().slice(0, 10);
    const released = all.filter(({ job }) => job.status === "released");
    const working = all.filter(({ job }) => WORKING.includes(job.status));
    const queue = all
      .filter(({ order, job }) => !jobDone(job) || inView(order, job, "ready_to_ship"))
      .sort((a, b) => rank(a.job) - rank(b.job) || dueOf(a.order, a.job).localeCompare(dueOf(b.order, b.job)))
      .slice(0, 10)
      .map(({ order, job }) => toPartnerJobDto(order, job, ok.who));
    const alerts = all.flatMap(({ job }): Schemas["FactoryTodayAlertDto"][] => {
      if (job.status === "released" && job.acceptDueAt) {
        const overdue = Date.parse(job.acceptDueAt) < Date.now();
        const soon = Date.parse(job.acceptDueAt) - Date.now() < 6 * 3_600_000;
        return overdue || soon
          ? [
              {
                kind: overdue ? "acceptance_overdue" : "acceptance_due_soon",
                jobId: job.id,
                jobNo: job.jobNo,
                dueAt: job.acceptDueAt,
              },
            ]
          : [];
      }
      const step = current(job);
      if (WORKING.includes(job.status) && job.atRisk && step?.dueAt && Date.parse(step.dueAt) < Date.now())
        return [{ kind: "step_overdue", jobId: job.id, jobNo: job.jobNo, dueAt: step.dueAt }];
      const inspection = inspections.find((item) => item.job.id === job.id && item.status === "planned");
      return inspection
        ? [{ kind: "inspection_planned", jobId: job.id, jobNo: job.jobNo, dueAt: inspection.scheduledAt }]
        : [];
    });
    return HttpResponse.json({
      counters: {
        awaitingAcceptance: released.length,
        acceptanceOverdue: released.filter(({ job }) => job.acceptDueAt && Date.parse(job.acceptDueAt) < Date.now())
          .length,
        milestonesDueToday: working.filter(({ job }) => current(job)?.dueAt?.slice(0, 10) === today).length,
        atRisk: working.filter(({ job }) => job.atRisk).length,
        onHold: all.filter(({ job }) => job.status === "on_hold").length,
        inspectionsPlanned: all.filter(({ job }) =>
          inspections.some((item) => item.job.id === job.id && item.status === "planned"),
        ).length,
      },
      queue,
      alerts,
    } satisfies Schemas["FactoryTodayDto"]);
  }),

  // partner.production.lookup: a job traveller's or carton label's code → the job, this factory only.
  http.get("*/v1/partner/production-jobs/lookup", ({ request }) => {
    const ok = mine(request, perm.read);
    if (ok instanceof Response) return ok;
    const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
    if (code.length < 3) return invalid("code", "อย่างน้อย 3 ตัวอักษร");
    const jobs = factoryJobs(ok.store.factory.id);
    const byCarton = cartonJob(code);
    const found = jobs.find(
      ({ job }) =>
        job.id === byCarton ||
        job.jobNo.toUpperCase() === code ||
        code.endsWith(job.jobNo.toUpperCase()) ||
        code.includes(job.id.toUpperCase()),
    );
    return found
      ? HttpResponse.json({ jobId: found.job.id, jobNo: found.job.jobNo } satisfies Schemas["JobLookupDto"])
      : problem(404, "http.not_found", "ไม่พบงานของโรงงานจากรหัสนี้");
  }),

  // partner.production.list: the factory's jobs by `?view` / `?status` / `?queue`, searched by `q`.
  http.get("*/v1/partner/production-jobs", ({ request }) => {
    const ok = mine(request, perm.read);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    if (view && !JOB_VIEWS.has(view)) return invalid("view", "ไม่รู้จักมุมมองนี้");
    const status = url.searchParams.get("status");
    const queue = url.searchParams.get("queue");
    const orderId = url.searchParams.get("orderId");
    const productTypeCode = url.searchParams.get("productTypeCode");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = factoryJobs(ok.store.factory.id)
      .filter(({ order, job }) => !view || inView(order, job, view))
      .filter(({ job }) => !status || job.status === status)
      .filter(
        ({ job }) =>
          !queue ||
          (queue === "awaiting_acceptance" && job.status === "released") ||
          (queue === "at_risk" && job.atRisk),
      )
      .filter(({ order }) => !orderId || order.id === orderId)
      .filter(({ order }) => !productTypeCode || order.productType.code === productTypeCode)
      .filter(({ order, job }) => matchesQuery(q, job.jobNo, titleOf(order), order.productType.name))
      .sort((a, b) => dueOf(a.order, a.job).localeCompare(dueOf(b.order, b.job)))
      .map(({ order, job }) => toPartnerJobDto(order, job, ok.who));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/partner/production-jobs/:jobId", ({ request, params }) => {
    const found = jobFor(request, params.jobId, perm.read);
    return found instanceof Response ? found : HttpResponse.json(toPartnerJobDto(found.order, found.job, found.who));
  }),

  // partner.production.accept: within the window (D-074); the route's first step is the acceptance.
  http.post("*/v1/partner/production-jobs/:jobId/actions/accept", ({ request, params }) =>
    once(request, `job-accept:${String(params.jobId)}`, () => {
      const found = jobFor(request, params.jobId, perm.respond);
      if (found instanceof Response) return found;
      const { order, job, extra } = found;
      if (job.status !== "released") return notWorking(job);
      Object.assign(job, { status: "accepted", milestones: routeFor(job, order) });
      extra.steps = new Map(ROUTE.map((_, index) => [index + 1, blankStep()]));
      Object.assign(extra.steps.get(1)!, { startedAt: now(), reportedBy: who(found.who) });
      extra.acceptedAt = now();
      const late = job.acceptDueAt && Date.parse(job.acceptDueAt) < Date.now();
      log(extra, late ? "โรงงานรับงาน (เลยเวลารับงาน)" : "โรงงานรับงาน", who(found.who));
      return HttpResponse.json(toPartnerJobDto(order, job, found.who));
    }),
  ),

  // partner.production.reject: with a reason; Packio reassigns or escalates (D-012, D-101).
  http.post("*/v1/partner/production-jobs/:jobId/actions/reject", ({ request, params }) =>
    once(request, `job-reject:${String(params.jobId)}`, async () => {
      const found = jobFor(request, params.jobId, perm.respond);
      if (found instanceof Response) return found;
      const { order, job, extra } = found;
      const body = (await request.json().catch(() => null)) as Schemas["RejectJobDto"] | null;
      if (!body || !REJECT_REASONS.has(body.reasonCode)) return invalid("reasonCode", "เลือกเหตุผล");
      if (job.status !== "released") return notWorking(job);
      job.status = "rejected";
      extra.rejected = { reasonCode: body.reasonCode, note: body.note?.trim() || null, at: now() };
      log(extra, `โรงงานปฏิเสธงาน${body.note ? `: ${body.note}` : ""}`, who(found.who));
      return HttpResponse.json(toPartnerJobDto(order, job, found.who));
    }),
  ),

  // partner.production.updateMilestone: start or complete one step; the server wins (`applied: false`).
  http.post("*/v1/partner/production-jobs/:jobId/milestones/:milestoneId", ({ request, params }) =>
    once(request, `milestone:${String(params.milestoneId)}`, async () => {
      const found = jobFor(request, params.jobId, perm.update);
      if (found instanceof Response) return found;
      const { order, job, extra } = found;
      const body = (await request.json().catch(() => null)) as Schemas["UpdateMilestoneDto"] | null;
      if (!body || !["start", "complete"].includes(body.action)) return invalid("action", "start หรือ complete");
      if (!body.clientRef) return invalid("clientRef", "จำเป็น");
      const milestone = job.milestones.find((item) => milestoneIdOf(job, item.seq) === params.milestoneId);
      if (!milestone) return problem(404, "http.not_found", "ไม่พบขั้นตอนนี้");
      const step = extra.steps.get(milestone.seq) ?? blankStep();
      const answer = (applied: boolean, reason: Schemas["MilestoneUpdateOutcome"] | null) =>
        HttpResponse.json({
          applied,
          reason,
          job: toPartnerJobDto(order, job, found.who),
        } satisfies Schemas["MilestoneUpdateResultDto"]);
      if (step.clientRef === body.clientRef) return answer(false, "duplicate");
      if (!WORKING.includes(job.status)) return notWorking(job);
      if (milestone.status === "skipped") return answer(false, "skipped");
      if (body.action === "start" && milestone.status !== "pending") return answer(false, "already_started");
      if (body.action === "complete" && milestone.status === "completed") return answer(false, "already_completed");
      if (job.milestones.some((item) => item.seq < milestone.seq && item.status === "pending"))
        return problem(409, "production.milestone_out_of_order", "ต้องทำขั้นตอนก่อนหน้าก่อน");
      const photoIds = body.photoFileIds ?? [];
      if (!photosExist(photoIds)) return problem(422, "artwork.file_not_usable", "ไม่พบไฟล์รูปที่อัปโหลด");
      const route = ROUTE[milestone.seq - 1]!;
      const reportedBy = who(found.who);
      if (body.action === "start") {
        milestone.status = "in_progress";
        Object.assign(step, {
          startedAt: now(),
          quantityIn: body.quantityIn ?? null,
          note: body.note ?? step.note,
          reportedBy,
          clientRef: body.clientRef,
        });
        step.photoIds.push(...photoIds);
        log(extra, `เริ่ม${route.nameTh}`, reportedBy);
      } else {
        const needsPhoto = route.evidence === "photo";
        const needsQc = route.evidence === "qc_form";
        if (needsPhoto && step.photoIds.length + photoIds.length === 0)
          return problem(409, "production.evidence_missing", "ขั้นตอนนี้ต้องแนบรูปถ่ายอย่างน้อยหนึ่งรูป");
        const latest = [...extra.qcChecks].sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
        if (needsQc && (!latest || latest.result === "fail"))
          return problem(409, "production.evidence_missing", "บันทึกผลตรวจคุณภาพที่ผ่านก่อนจบขั้นตอนนี้");
        if (route.tracksQuantity) {
          if (body.quantityOut === undefined)
            return problem(422, "validation.failed", "ขั้นตอนนี้ต้องระบุจำนวน", [
              { path: "quantityOut", code: "required", message: "ระบุจำนวนดี" },
            ]);
          const previous = [...extra.steps.entries()]
            .sort(([a], [b]) => b - a)
            .find(([seq, item]) => seq < milestone.seq && ROUTE[seq - 1]?.tracksQuantity && item.quantityOut !== null);
          const ceiling =
            body.quantityIn ??
            step.quantityIn ??
            previous?.[1].quantityOut ??
            Math.floor(order.quantity * (1 + Number(order.tolerance.overagePct) / 100) + 1e-9);
          const scrap = body.quantityScrap ?? 0;
          if (body.quantityOut + scrap > ceiling)
            return problem(
              422,
              "production.quantity_invalid",
              `ดีรวมเสียได้ไม่เกิน ${ceiling.toLocaleString("th-TH")} ชิ้น`,
            );
          Object.assign(step, {
            quantityIn: body.quantityIn ?? step.quantityIn ?? previous?.[1].quantityOut ?? null,
            quantityOut: body.quantityOut,
            quantityScrap: scrap,
          });
        }
        step.photoIds.push(...photoIds);
        Object.assign(step, {
          startedAt: step.startedAt ?? now(),
          note: body.note ?? step.note,
          reportedBy,
          clientRef: body.clientRef,
        });
        Object.assign(milestone, {
          status: "completed",
          completedAt: now(),
          onTime: milestone.dueAt ? Date.parse(milestone.dueAt) >= Date.now() : null,
        });
        log(
          extra,
          route.tracksQuantity
            ? `จบ${route.nameTh}: ดี ${(step.quantityOut ?? 0).toLocaleString("th-TH")} เสีย ${(step.quantityScrap ?? 0).toLocaleString("th-TH")}`
            : `จบ${route.nameTh}`,
          reportedBy,
        );
      }
      extra.steps.set(milestone.seq, step);
      if (job.status === "accepted") job.status = "in_progress";
      if (job.milestones.every((item) => item.status === "completed" || item.status === "skipped")) {
        job.status = "completed";
        job.atRisk = false;
        log(extra, "ผลิตเสร็จ พร้อมส่ง", reportedBy);
      }
      return answer(true, null);
    }),
  ),

  // partner.production.recordQc: against the checklist the factory answered (D-076); a photo is required.
  http.post("*/v1/partner/production-jobs/:jobId/qc-checks", ({ request, params }) =>
    once(request, `qc:${String(params.jobId)}`, async () => {
      const found = jobFor(request, params.jobId, perm.qc);
      if (found instanceof Response) return found;
      const { job, extra } = found;
      const body = (await request.json().catch(() => null)) as Schemas["RecordQcDto"] | null;
      if (!body?.checklistVersion) return invalid("checklistVersion", "จำเป็น");
      if (!body.checklist || typeof body.checklist !== "object") return invalid("checklist", "จำเป็น");
      if (!["pass", "fail", "conditional"].includes(body.result)) return invalid("result", "เลือกผลรวม");
      const defects = body.defects ?? [];
      if (defects.some((item) => !["critical", "major", "minor"].includes(item.severity) || item.count < 1))
        return invalid("defects", "ระบุระดับและจำนวนของข้อบกพร่อง");
      if (!WORKING.includes(job.status)) return notWorking(job);
      if (!body.photoFileIds?.length) return problem(409, "production.evidence_missing", "แนบรูปอย่างน้อยหนึ่งรูป");
      if (!photosExist(body.photoFileIds)) return problem(422, "artwork.file_not_usable", "ไม่พบไฟล์รูปที่อัปโหลด");
      const check: QcCheck = {
        id: mockId("qcc", 100 + extra.qcChecks.length + Number.parseInt(job.id.slice(-4), 16) * 8),
        result: body.result,
        isFirstPass: extra.qcChecks.length === 0 && body.result === "pass",
        checklist: body.checklist,
        checklistVersion: body.checklistVersion,
        defects,
        photoFileIds: [...body.photoFileIds],
        note: body.note ?? null,
        quantityChecked: body.quantityChecked ?? null,
        quantityDefective: body.quantityDefective ?? null,
        performedAt: now(),
        performedBy: who(found.who),
      };
      extra.qcChecks.push(check);
      log(
        extra,
        `บันทึกผลตรวจคุณภาพ: ${body.result === "pass" ? "ผ่าน" : body.result === "fail" ? "ไม่ผ่าน" : "ผ่านแบบมีเงื่อนไข"}`,
        who(found.who),
      );
      return HttpResponse.json(check, { status: 201 });
    }),
  ),
  http.get("*/v1/partner/production-jobs/:jobId/qc-checks", ({ request, params }) => {
    const found = jobFor(request, params.jobId, perm.read);
    return found instanceof Response ? found : HttpResponse.json(found.extra.qcChecks);
  }),

  // partner.production.raiseIssue (D-232): the kinds are named; Packio sees it on the board.
  http.post("*/v1/partner/production-jobs/:jobId/issues", async ({ request, params }) => {
    const act = async () => {
      const found = jobFor(request, params.jobId, perm.issues);
      if (found instanceof Response) return found;
      const { job, extra } = found;
      const body = (await request.json().catch(() => null)) as Schemas["RaiseIssueDto"] | null;
      if (!body || !ISSUE_KINDS.has(body.kind)) return invalid("kind", "เลือกประเภทปัญหา");
      if (!body.description || body.description.trim().length < 3)
        return invalid("description", "อย่างน้อย 3 ตัวอักษร");
      const photoIds = body.photoFileIds ?? [];
      if (!photosExist(photoIds)) return problem(422, "artwork.file_not_usable", "ไม่พบไฟล์รูปที่อัปโหลด");
      const issue: Issue = {
        id: mockId("iss", 100 + extra.issues.length + Number.parseInt(job.id.slice(-4), 16) * 8),
        kind: body.kind,
        description: body.description.trim(),
        status: "open",
        photoFileIds: [...photoIds],
        raisedBy: who(found.who),
        createdAt: now(),
        resolutionNote: null,
        resolvedAt: null,
        resolvedBy: null,
      };
      extra.issues.push(issue);
      log(extra, `แจ้งปัญหา: ${issue.description}`, who(found.who));
      return HttpResponse.json(issue, { status: 201 });
    };
    // The key is optional here (contract v0.6.0): a replay by key answers the first issue.
    return request.headers.get("idempotency-key") ? once(request, `issue:${String(params.jobId)}`, act) : act();
  }),
  http.get("*/v1/partner/production-jobs/:jobId/issues", ({ request, params }) => {
    const found = jobFor(request, params.jobId, perm.read);
    return found instanceof Response ? found : HttpResponse.json(found.extra.issues);
  }),

  // partner.production.resolveIssue (D-232): the factory closes an issue its own people raised.
  http.post("*/v1/partner/production-jobs/:jobId/issues/:issueId/actions/resolve", async ({ request, params }) => {
    const act = async () => {
      const found = jobFor(request, params.jobId, perm.issues);
      if (found instanceof Response) return found;
      const body = (await request.json().catch(() => null)) as Schemas["ResolveIssueDto"] | null;
      if (!body?.note?.trim()) return invalid("note", "บอกว่าแก้อย่างไร");
      const issue = found.extra.issues.find((item) => item.id === params.issueId);
      if (!issue) return problem(404, "http.not_found", "ไม่พบปัญหานี้");
      if (issue.status === "resolved") return problem(409, "production.invalid_status", "ปัญหานี้แก้แล้ว");
      Object.assign(issue, {
        status: "resolved",
        resolvedAt: now(),
        resolvedBy: who(found.who),
        resolutionNote: body.note.trim(),
      });
      log(found.extra, `แก้ปัญหาแล้ว: ${body.note.trim()}`, who(found.who));
      return HttpResponse.json(issue);
    };
    return request.headers.get("idempotency-key") ? once(request, `resolve:${String(params.issueId)}`, act) : act();
  }),

  // partner.factories.capacityCalendar: weeks × product types against the booked load (D-101), and
  // the days the factory does not work — the national calendar's and its own (D-161).
  http.get("*/v1/partner/factories/:factoryId/capacity-calendar", ({ request, params }) => {
    const ok = own(request, params.factoryId, perm.capacity);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const weeks = Math.min(26, Math.max(1, Number(url.searchParams.get("weeks") ?? 6)));
    const monday = new Date(Date.now() + 7 * 3_600_000);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const store = stores.get(ok.store.factory.id)!;
    const weekStart = (index: number) => new Date(monday.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
    return HttpResponse.json({
      from: weekStart(0),
      to: new Date(monday.getTime() + (weeks * 7 - 1) * 86_400_000).toISOString().slice(0, 10),
      productTypes: store.config.capacities
        .filter((capacity) => capacity.current)
        .map((capacity) => {
          const type = PRODUCT_TYPES.find((item) => item.id === capacity.productTypeId);
          return {
            productTypeId: capacity.productTypeId,
            productTypeCode: capacity.productTypeCode,
            productTypeNameTh: type?.nameTh ?? capacity.productTypeCode,
            unit: capacity.current!.capacityUnit,
            weeks: Array.from({ length: weeks }, (_, index) => {
              const start = weekStart(index);
              const override = store.overrides.get(`${capacity.productTypeId}:${start}`);
              const total = override ?? Number(capacity.current!.weeklyCapacity);
              const booked = Math.round(total * Math.max(0, 0.9 - index * 0.15));
              return {
                weekStart: start,
                capacity: total.toFixed(3),
                booked: booked.toFixed(3),
                free: (total - booked).toFixed(3),
                source: override === undefined ? ("version" as const) : ("override" as const),
              };
            }),
          };
        }),
      days: [
        {
          day: bangkokIso(DAY * 9).slice(0, 10),
          kind: "closure",
          nameTh: "วันหยุดประจำปีของโรงงาน (ข้อมูลจำลอง)",
          nameEn: "Factory annual closure (mock)",
          source: "factory",
        },
        {
          day: bangkokIso(DAY * 16).slice(0, 10),
          kind: "holiday",
          nameTh: "วันหยุดนักขัตฤกษ์ (ข้อมูลจำลอง)",
          nameEn: "Public holiday (mock)",
          source: "national",
        },
      ],
    } satisfies Schemas["CapacityCalendarDto"]);
  }),

  // partner.payables.listPurchaseOrders: the factory's own POs — the same rows Finance keeps
  // (`../admin/finance/payables.ts`), read lazily to keep the module graph acyclic.
  http.get("*/v1/partner/purchase-orders", async ({ request }) => {
    const ok = mine(request, perm.payables);
    if (ok instanceof Response) return ok;
    const { purchaseOrders } = await import("../admin/finance/payables");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows = purchaseOrders()
      .filter((row) => row.factoryId === ok.store.factory.id)
      .map((row) => row.po)
      .filter((po) => matchesQuery(q, po.poNumber, po.jobNo, po.orderCode));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  // partner.files.download for what the floor reads: the approved proof and the factory's own
  // uploads (step photos, QC photos). Anything else falls through to the next handler.
  http.get("*/v1/partner/files/:fileId/download", ({ request, params }) => {
    const fileId = String(params.fileId);
    const ok = mine(request);
    if (ok instanceof Response) return undefined;
    const proof = factoryJobs(ok.store.factory.id)
      .map(({ order }) => approvedProofOf(order))
      .find((item) => item?.file.id === fileId);
    const url = proof
      ? (proof.file.url ??
        `data:text/plain;charset=utf-8,${encodeURIComponent(`${proof.file.originalName} (ข้อมูลจำลอง)`)}`)
      : files.has(fileId)
        ? (fileDataUrl(fileId) ??
          `data:text/plain;charset=utf-8,${encodeURIComponent(files.get(fileId)!.originalName)}`)
        : null;
    if (!url) return undefined;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
